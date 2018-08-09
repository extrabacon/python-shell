import {EventEmitter} from 'events';
import { ChildProcess,spawn, SpawnOptions } from 'child_process';
import {EOL as newline} from 'os';
import {join} from 'path'

function toArray<T>(source?:T|T[]):T[] {
    if (typeof source === 'undefined' || source === null) {
        return [];
    } else if (!Array.isArray(source)) {
        return [source];
    }
    return source;
}

/**
 * adds arguments as properties to obj
 */
function extend(obj:{}, ...args) {
    Array.prototype.slice.call(arguments, 1).forEach(function (source) {
        if (source) {
            for (let key in source) {
                obj[key] = source[key];
            }
        }
    });
    return obj;
}

interface Options extends SpawnOptions{
    mode: 'text'|'json'|'binary'
    formatter: (param:string)=>any
    parser: (param:string)=>any
    encoding: string
    pythonPath: string
    pythonOptions: string[]
    scriptPath: string
    args: string[]
}

class PythonShellError extends Error{
    traceback: string | Buffer;
}

/**
 * An interactive Python shell exchanging data through stdio
 * @param {string} script    The python script to execute
 * @param {object} [options] The launch options (also passed to child_process.spawn)
 * @constructor
 */
class PythonShell extends EventEmitter{
    script:string
    command:string[]
    mode:string
    formatter:(param:string|Object)=>any
    parser:(param:string)=>any
    terminated:boolean
    childProcess:ChildProcess
    stdin: NodeJS.WriteStream; //or writeable stream? Whats difference?
    stdout: NodeJS.ReadStream;
    stderr: NodeJS.ReadStream;
    private stderrHasEnded:boolean;
    private stdoutHasEnded:boolean;
    private exitCode:number;
    private exitSignal:string;
    private _remaining:string
    private _endCallback:(err:PythonShellError, exitCode:number, exitSignal:string)=>any

    //@ts-ignore keeping it initialized to {} for backwards API compatability
    static defaultOptions:Options = {}; //allow global overrides for options
    
    constructor(script:string, options:Options) {
        super();

        /**
         * returns either pythonshell func (if val string) or custom func (if val Function)
         */
        function resolve(type, val:string|Function) {
            if (typeof val === 'string') {
                // use a built-in function using its name
                return PythonShell[type][val];
            } else if (typeof val === 'function') {
                // use a custom function
                return val;
            }
        }

        let self = this;
        let errorData = '';
        EventEmitter.call(this);

        options = <Options>extend({}, PythonShell.defaultOptions, options);
        let pythonPath;
        if (!options.pythonPath) {
            // starting 2020 python2 is deprecated so we choose 3 as default
            // except for windows which just has "python" command
            pythonPath = process.platform != "win32" ? "python3" : "python"
        } else pythonPath = options.pythonPath;
        let pythonOptions = toArray(options.pythonOptions);
        let scriptArgs = toArray(options.args);

        this.script = join(options.scriptPath || './', script);
        this.command = pythonOptions.concat(this.script, scriptArgs);
        this.mode = options.mode || 'text';
        this.formatter = resolve('format', options.formatter || this.mode);
        this.parser = resolve('parse', options.parser || this.mode);
        this.terminated = false;
        this.childProcess = spawn(pythonPath, this.command, options);

        ['stdout', 'stdin', 'stderr'].forEach(function (name) {
            self[name] = self.childProcess[name];
            self.parser && self[name].setEncoding(options.encoding || 'utf8');
        });

        // parse incoming data on stdout
        if (this.parser) {
            this.stdout.on('data', this.receive.bind(this));
        }

        // listen to stderr and emit errors for incoming data
        this.stderr.on('data', function (data) {
            errorData += ''+data;
        });

        this.stderr.on('end', function(){
            self.stderrHasEnded = true
            terminateIfNeeded();
        })

        this.stdout.on('end', function(){
            self.stdoutHasEnded = true
            terminateIfNeeded();
        })

        this.childProcess.on('exit', function (code,signal) {
            self.exitCode = code;
            self.exitSignal = signal;
            terminateIfNeeded();
        });

        function terminateIfNeeded() {
            if(!self.stderrHasEnded || !self.stdoutHasEnded || (self.exitCode == null && self.exitSignal == null)) return;

            let err:PythonShellError;
            if (errorData || (self.exitCode && self.exitCode !== 0)) {
                if (errorData) {
                    err = self.parseError(errorData);
                } else {
                    err = new PythonShellError('process exited with code ' + self.exitCode);
                }
                err = <PythonShellError>extend(err, {
                    executable: pythonPath,
                    options: pythonOptions.length ? pythonOptions : null,
                    script: self.script,
                    args: scriptArgs.length ? scriptArgs : null,
                    exitCode: self.exitCode
                });
                // do not emit error if only a callback is used
                if (self.listeners('error').length || !self._endCallback) {
                    self.emit('error', err);
                }
            }

            self.terminated = true;
            self.emit('close');
            self._endCallback && self._endCallback(err,self.exitCode,self.exitSignal);
        };
    }

    // built-in formatters
    static format = {
        text: function toText(data):string {
            if (!data) return '';
            else if (typeof data !== 'string') return data.toString();
            return data;
        },
        json: function toJson(data) {
            return JSON.stringify(data);
        }
    };

    //built-in parsers
    static parse = {
        text: function asText(data):string {
            return data;
        },
        json: function asJson(data:string) {
            return JSON.parse(data);
        }
    };

    /**
     * Runs a Python script and returns collected messages
     * @param  {string}   script   The script to execute
     * @param  {Options}   options  The execution options
     * @param  {Function} callback The callback function to invoke with the script results
     * @return {PythonShell}       The PythonShell instance
     */
    static run(script:string, options:Options, callback:(err:PythonShellError, output?:any[])=>any) {
        if (typeof options === 'function') {
            callback = options;
            options = null;
        }

        let pyshell = new PythonShell(script, options);
        let output = [];

        return pyshell.on('message', function (message) {
            output.push(message);
        }).end(function (err) {
            if (err) return callback(err);
            return callback(null, output.length ? output : null);
        });
    };

    /**
     * Parses an error thrown from the Python process through stderr
     * @param  {string|Buffer} data The stderr contents to parse
     * @return {Error} The parsed error with extended stack trace when traceback is available
     */
    private parseError(data:string|Buffer) {
        let text = ''+data;
        let error:PythonShellError;

        if (/^Traceback/.test(text)) {
            // traceback data is available
            let lines = (''+data).trim().split(new RegExp(newline, 'g'));
            let exception = lines.pop();
            error = new PythonShellError(exception);
            error.traceback = data;
            // extend stack trace
            error.stack += newline+'    ----- Python Traceback -----'+newline+'  ';
            error.stack += lines.slice(1).join(newline+'  ');
        } else {
            // otherwise, create a simpler error with stderr contents
            error = new PythonShellError(text);
        }

        return error;
    };

    /**
     * Sends a message to the Python shell through stdin
     * Override this method to format data to be sent to the Python process
     * @param {string|Object} data The message to send
     * @returns {PythonShell} The same instance for chaining calls
     */
    send(message:string|Object) {
        let data = this.formatter ? this.formatter(message) : message;
        if (this.mode !== 'binary') data += newline;
        this.stdin.write(data);
        return this;
    };

    /**
     * Parses data received from the Python shell stdout stream and emits "message" events
     * This method is not used in binary mode
     * Override this method to parse incoming data from the Python process into messages
     * @param {string|Buffer} data The data to parse into messages
     */
    receive(data:string|Buffer) {
        let self = this;
        let parts = (''+data).split(new RegExp(newline,'g'));

        if (parts.length === 1) {
            // an incomplete record, keep buffering
            this._remaining = (this._remaining || '') + parts[0];
            return this;
        }

        let lastLine = parts.pop();
        // fix the first line with the remaining from the previous iteration of 'receive'
        parts[0] = (this._remaining || '') + parts[0];
        // keep the remaining for the next iteration of 'receive'
        this._remaining = lastLine;

        parts.forEach(function (part) {
            self.emit('message', self.parser(part));
        });

        return this;
    };

    /**
     * Closes the stdin stream, which should cause the process to finish its work and close
     * @returns {PythonShell} The same instance for chaining calls
     */
    end(callback:(err:PythonShellError, exitCode:number,exitSignal:string)=>any) {
        this.childProcess.stdin.end();
        this._endCallback = callback;
        return this;
    };

    /**
     * Closes the stdin stream, which should cause the process to finish its work and close
     * @returns {PythonShell} The same instance for chaining calls
     */
    terminate(signal?:string) {
        this.childProcess.kill(signal);
        this.terminated = true;
        return this;
    };
};


module.exports = PythonShell;
