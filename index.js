"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const child_process_1 = require("child_process");
const os_1 = require("os");
const path_1 = require("path");
const fs_1 = require("fs");
function toArray(source) {
    if (typeof source === 'undefined' || source === null) {
        return [];
    }
    else if (!Array.isArray(source)) {
        return [source];
    }
    return source;
}
/**
 * adds arguments as properties to obj
 */
function extend(obj, ...args) {
    Array.prototype.slice.call(arguments, 1).forEach(function (source) {
        if (source) {
            for (let key in source) {
                obj[key] = source[key];
            }
        }
    });
    return obj;
}
class PythonShellError extends Error {
}
/**
 * An interactive Python shell exchanging data through stdio
 * @param {string} script    The python script to execute
 * @param {object} [options] The launch options (also passed to child_process.spawn)
 * @constructor
 */
class PythonShell extends events_1.EventEmitter {
    constructor(scriptPath, options) {
        super();
        /**
         * returns either pythonshell func (if val string) or custom func (if val Function)
         */
        function resolve(type, val) {
            if (typeof val === 'string') {
                // use a built-in function using its name
                return PythonShell[type][val];
            }
            else if (typeof val === 'function') {
                // use a custom function
                return val;
            }
        }
        let self = this;
        let errorData = '';
        events_1.EventEmitter.call(this);
        options = extend({}, PythonShell.defaultOptions, options);
        let pythonPath;
        if (!options.pythonPath) {
            pythonPath = PythonShell.defaultPythonPath;
        }
        else
            pythonPath = options.pythonPath;
        let pythonOptions = toArray(options.pythonOptions);
        let scriptArgs = toArray(options.args);
        this.scriptPath = path_1.join(options.scriptPath || './', scriptPath);
        this.command = pythonOptions.concat(this.scriptPath, scriptArgs);
        this.mode = options.mode || 'text';
        this.formatter = resolve('format', options.formatter || this.mode);
        this.parser = resolve('parse', options.parser || this.mode);
        this.stderrParser = resolve('parse', options.stderrParser || this.mode);
        this.terminated = false;
        this.childProcess = child_process_1.spawn(pythonPath, this.command, options);
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
            errorData += '' + data;
            self.receiveStderr(data);
        });
        this.stderr.on('end', function () {
            self.stderrHasEnded = true;
            terminateIfNeeded();
        });
        this.stdout.on('end', function () {
            self.stdoutHasEnded = true;
            terminateIfNeeded();
        });
        this.childProcess.on('exit', function (code, signal) {
            self.exitCode = code;
            self.exitSignal = signal;
            terminateIfNeeded();
        });
        function terminateIfNeeded() {
            if (!self.stderrHasEnded || !self.stdoutHasEnded || (self.exitCode == null && self.exitSignal == null))
                return;
            let err;
            if (self.exitCode && self.exitCode !== 0) {
                if (errorData) {
                    err = self.parseError(errorData);
                }
                else {
                    err = new PythonShellError('process exited with code ' + self.exitCode);
                }
                err = extend(err, {
                    executable: pythonPath,
                    options: pythonOptions.length ? pythonOptions : null,
                    script: self.scriptPath,
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
            self._endCallback && self._endCallback(err, self.exitCode, self.exitSignal);
        }
        ;
    }
    /**
     * checks syntax without executing code
     * @param {string} code
     * @returns {Promise} rejects w/ stderr if syntax failure
     */
    static checkSyntax(code) {
        return __awaiter(this, void 0, void 0, function* () {
            let randomInt = PythonShell.getRandomInt();
            let filePath = os_1.tmpdir + path_1.sep + `pythonShellSyntaxCheck${randomInt}.py`;
            // todo: replace this with util.promisify (once we no longer support node v7)
            return new Promise((resolve, reject) => {
                fs_1.writeFile(filePath, code, (err) => {
                    if (err)
                        reject(err);
                    resolve(this.checkSyntaxFile(filePath));
                });
            });
        });
    }
    /**
     * checks syntax without executing code
     * @param {string} filePath
     * @returns {Promise} rejects w/ stderr if syntax failure
     */
    static checkSyntaxFile(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            let compileCommand = `${this.defaultPythonPath} -m py_compile ${filePath}`;
            return new Promise((resolve, reject) => {
                child_process_1.exec(compileCommand, (error, stdout, stderr) => {
                    if (error == null)
                        resolve();
                    else
                        reject(stderr);
                });
            });
        });
    }
    /**
     * Runs a Python script and returns collected messages
     * @param  {string}   scriptPath   The path to the script to execute
     * @param  {Options}   options  The execution options
     * @param  {Function} callback The callback function to invoke with the script results
     * @return {PythonShell}       The PythonShell instance
     */
    static run(scriptPath, options, callback) {
        let pyshell = new PythonShell(scriptPath, options);
        let output = [];
        return pyshell.on('message', function (message) {
            output.push(message);
        }).end(function (err) {
            if (err)
                return callback(err);
            return callback(null, output.length ? output : null);
        });
    }
    ;
    /**
     * Runs the inputted string of python code and returns collected messages. DO NOT ALLOW UNTRUSTED USER INPUT HERE!
     * @param  {string}   code   The python code to execute
     * @param  {Options}   options  The execution options
     * @param  {Function} callback The callback function to invoke with the script results
     * @return {PythonShell}       The PythonShell instance
     */
    static runString(code, options, callback) {
        // put code in temp file
        let randomInt = PythonShell.getRandomInt();
        let filePath = os_1.tmpdir + path_1.sep + `pythonShellFile${randomInt}.py`;
        fs_1.writeFileSync(filePath, code);
        return PythonShell.run(filePath, options, callback);
    }
    ;
    /**
     * Parses an error thrown from the Python process through stderr
     * @param  {string|Buffer} data The stderr contents to parse
     * @return {Error} The parsed error with extended stack trace when traceback is available
     */
    parseError(data) {
        let text = '' + data;
        let error;
        if (/^Traceback/.test(text)) {
            // traceback data is available
            let lines = ('' + data).trim().split(new RegExp(os_1.EOL, 'g'));
            let exception = lines.pop();
            error = new PythonShellError(exception);
            error.traceback = data;
            // extend stack trace
            error.stack += os_1.EOL + '    ----- Python Traceback -----' + os_1.EOL + '  ';
            error.stack += lines.slice(1).join(os_1.EOL + '  ');
        }
        else {
            // otherwise, create a simpler error with stderr contents
            error = new PythonShellError(text);
        }
        return error;
    }
    ;
    /**
     * gets a random int from 0-10000000000
     */
    static getRandomInt() {
        return Math.floor(Math.random() * 10000000000);
    }
    /**
     * Sends a message to the Python shell through stdin
     * Override this method to format data to be sent to the Python process
     * @param {string|Object} data The message to send
     * @returns {PythonShell} The same instance for chaining calls
     */
    send(message) {
        let data = this.formatter ? this.formatter(message) : message;
        if (this.mode !== 'binary')
            data += os_1.EOL;
        this.stdin.write(data);
        return this;
    }
    ;
    /**
     * Parses data received from the Python shell stdout stream and emits "message" events
     * This method is not used in binary mode
     * Override this method to parse incoming data from the Python process into messages
     * @param {string|Buffer} data The data to parse into messages
     */
    receive(data) {
        return this.recieveInternal(data, 'message');
    }
    ;
    /**
     * Parses data received from the Python shell stderr stream and emits "stderr" events
     * This method is not used in binary mode
     * Override this method to parse incoming logs from the Python process into messages
     * @param {string|Buffer} data The data to parse into messages
     */
    receiveStderr(data) {
        return this.recieveInternal(data, 'stderr');
    }
    ;
    recieveInternal(data, emitType) {
        let self = this;
        let parts = ('' + data).split(new RegExp(os_1.EOL, 'g'));
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
            if (emitType == 'message')
                self.emit(emitType, self.parser(part));
            else if (emitType == 'stderr')
                self.emit(emitType, self.stderrParser(part));
        });
        return this;
    }
    /**
     * Closes the stdin stream, which should cause the process to finish its work and close
     * @returns {PythonShell} The same instance for chaining calls
     */
    end(callback) {
        this.childProcess.stdin.end();
        this._endCallback = callback;
        return this;
    }
    ;
    /**
     * Closes the stdin stream, which should cause the process to finish its work and close
     * @returns {PythonShell} The same instance for chaining calls
     */
    terminate(signal) {
        this.childProcess.kill(signal);
        this.terminated = true;
        return this;
    }
    ;
}
// starting 2020 python2 is deprecated so we choose 3 as default
// except for windows which just has "python" command
PythonShell.defaultPythonPath = process.platform != "win32" ? "python3" : "python";
PythonShell.defaultOptions = {}; //allow global overrides for options
// built-in formatters
PythonShell.format = {
    text: function toText(data) {
        if (!data)
            return '';
        else if (typeof data !== 'string')
            return data.toString();
        return data;
    },
    json: function toJson(data) {
        return JSON.stringify(data);
    }
};
//built-in parsers
PythonShell.parse = {
    text: function asText(data) {
        return data;
    },
    json: function asJson(data) {
        return JSON.parse(data);
    }
};
exports.PythonShell = PythonShell;
;
//# sourceMappingURL=index.js.map