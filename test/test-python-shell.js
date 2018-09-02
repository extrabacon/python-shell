"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const should = require("should");
const __1 = require("..");
const path_1 = require("path");
const os_1 = require("os");
describe('PythonShell', function () {
    __1.PythonShell.defaultOptions = {
        scriptPath: './test/python'
    };
    describe('#ctor(script, options)', function () {
        it('should spawn a Python process', function (done) {
            let pyshell = new __1.PythonShell('exit-code.py');
            pyshell.command.should.eql(['test' + path_1.sep + 'python' + path_1.sep + 'exit-code.py']);
            pyshell.terminated.should.be.false;
            pyshell.end(function (err) {
                if (err)
                    return done(err);
                pyshell.terminated.should.be.true;
                done();
            });
        });
        it('should spawn a Python process with options', function (done) {
            let pyshell = new __1.PythonShell('exit-code.py', {
                pythonOptions: ['-u']
            });
            pyshell.command.should.eql(['-u', 'test' + path_1.sep + 'python' + path_1.sep + 'exit-code.py']);
            pyshell.end(done);
        });
        it('should spawn a Python process with script arguments', function (done) {
            let pyshell = new __1.PythonShell('echo_args.py', {
                args: ['hello', 'world']
            });
            pyshell.command.should.eql(['test' + path_1.sep + 'python' + path_1.sep + 'echo_args.py', 'hello', 'world']);
            pyshell.end(done);
        });
    });
    describe('#checkSyntax(code:string)', function () {
        // note checkSyntax is a wrapper around checkSyntaxFile
        // so this tests checkSyntaxFile as well
        it('should check syntax', function (done) {
            __1.PythonShell.checkSyntax("x=1").then(() => {
                done();
            });
        });
        it('should invalidate bad syntax', function (done) {
            __1.PythonShell.checkSyntax("x=").catch(() => {
                done();
            });
        });
    });
    describe('#runString(script, options)', function () {
        before(() => {
            __1.PythonShell.defaultOptions = {};
        });
        it('should be able to execute a string of python code', function (done) {
            __1.PythonShell.runString('print("hello");print("world")', null, function (err, results) {
                if (err)
                    return done(err);
                results.should.be.an.Array().and.have.lengthOf(2);
                results.should.eql(['hello', 'world']);
                done();
            });
        });
        after(() => {
            __1.PythonShell.defaultOptions = {
                // reset to match initial value
                scriptPath: './test/python'
            };
        });
    });
    describe('#run(script, options)', function () {
        it('should run the script and return output data', function (done) {
            __1.PythonShell.run('echo_args.py', {
                args: ['hello', 'world']
            }, function (err, results) {
                if (err)
                    return done(err);
                results.should.be.an.Array().and.have.lengthOf(2);
                results.should.eql(['hello', 'world']);
                done();
            });
        });
        it('should try to run the script and fail appropriately', function (done) {
            __1.PythonShell.run('unknown_script.py', null, function (err, results) {
                err.should.be.an.Error;
                err.exitCode.should.be.exactly(2);
                done();
            });
        });
        it('should run the script and fail with an extended stack trace', function (done) {
            __1.PythonShell.run('error.py', null, function (err, results) {
                err.should.be.an.Error;
                err.exitCode.should.be.exactly(1);
                err.stack.should.containEql('----- Python Traceback -----');
                done();
            });
        });
        it('should run multiple scripts and fail with an extended stack trace for each of them', function (done) {
            let numberOfTimesToRun = 20;
            for (let i = 0; i < numberOfTimesToRun; i++) {
                runSingleErrorScript(end);
            }
            let count = 0;
            function end() {
                count++;
                if (count === numberOfTimesToRun) {
                    done();
                }
            }
            function runSingleErrorScript(callback) {
                __1.PythonShell.run('error.py', null, function (err, results) {
                    err.should.be.an.Error;
                    err.exitCode.should.be.exactly(1);
                    err.stack.should.containEql('----- Python Traceback -----');
                    callback();
                });
            }
        });
        it('should run multiple scripts and return output data for each of them', function (done) {
            let numberOfTimesToRun = 20;
            for (let i = 0; i < numberOfTimesToRun; i++) {
                runSingleScript(end);
            }
            let count = 0;
            function end() {
                count++;
                if (count === numberOfTimesToRun) {
                    done();
                }
            }
            function runSingleScript(callback) {
                __1.PythonShell.run('echo_args.py', {
                    args: ['hello', 'world']
                }, function (err, results) {
                    if (err)
                        return done(err);
                    results.should.be.an.Array().and.have.lengthOf(2);
                    results.should.eql(['hello', 'world']);
                    callback();
                });
            }
        });
    });
    describe('.send(message)', function () {
        it('should send string messages when mode is "text"', function (done) {
            let pyshell = new __1.PythonShell('echo_text.py', {
                mode: 'text'
            });
            let output = '';
            pyshell.stdout.on('data', function (data) {
                output += '' + data;
            });
            pyshell.send('hello').send('world').end(function (err) {
                if (err)
                    return done(err);
                output.should.be.exactly('hello' + os_1.EOL + 'world' + os_1.EOL);
                done();
            });
        });
        it('should send JSON messages when mode is "json"', function (done) {
            let pyshell = new __1.PythonShell('echo_json.py', {
                mode: 'json'
            });
            let output = '';
            pyshell.stdout.on('data', function (data) {
                output += '' + data;
            });
            pyshell.send({ a: 'b' }).send(null).send([1, 2, 3]).end(function (err) {
                if (err)
                    return done(err);
                output.should.be.exactly('{"a": "b"}' + os_1.EOL + 'null' + os_1.EOL + '[1, 2, 3]' + os_1.EOL);
                done();
            });
        });
        it('should use a custom formatter', function (done) {
            let pyshell = new __1.PythonShell('echo_text.py', {
                formatter: function (message) {
                    return message.toUpperCase();
                }
            });
            let output = '';
            pyshell.stdout.on('data', function (data) {
                output += '' + data;
            });
            pyshell.send('hello').send('world').end(function (err) {
                if (err)
                    return done(err);
                output.should.be.exactly('HELLO' + os_1.EOL + 'WORLD' + os_1.EOL + '');
                done();
            });
        });
        it('should write as-is when mode is "binary"', function (done) {
            let pyshell = new __1.PythonShell('echo_binary.py', {
                mode: 'binary'
            });
            let output = '';
            pyshell.stdout.on('data', function (data) {
                output += '' + data;
            });
            pyshell.send(new Buffer('i am not a string')).end(function (err) {
                if (err)
                    return done(err);
                output.should.be.exactly('i am not a string');
                done();
            });
        });
    });
    describe('.receive(data)', function () {
        it('should emit messages as strings when mode is "text"', function (done) {
            let pyshell = new __1.PythonShell('echo_text.py', {
                mode: 'text'
            });
            let count = 0;
            pyshell.on('message', function (message) {
                count === 0 && message.should.be.exactly('hello');
                count === 1 && message.should.be.exactly('world');
                count++;
            }).on('close', function () {
                count.should.be.exactly(2);
            }).send('hello').send('world').end(done);
        });
        it('should emit messages as JSON when mode is "json"', function (done) {
            let pyshell = new __1.PythonShell('echo_json.py', {
                mode: 'json'
            });
            let count = 0;
            pyshell.send({ a: 'b' }).send(null).send([1, 2, 3, 4, 5]);
            pyshell.on('message', function (message) {
                count === 0 && message.should.eql({ a: 'b' });
                count === 1 && should(message).eql(null);
                count === 2 && message.should.eql([1, 2, 3, 4, 5]);
                count++;
            }).on('close', function () {
                count.should.be.exactly(3);
            }).end(done);
        });
        it('should properly buffer partial messages', function (done) {
            let pyshell = new __1.PythonShell('echo_json.py', {
                mode: 'json'
            });
            pyshell.on('message', function (message) {
                message.should.be.an.Object;
                message.should.eql({ a: true });
            }).receive('{"a"').receive(':').receive('true}' + os_1.EOL + '').end(done);
        });
        it('should not be invoked when mode is "binary"', function (done) {
            let pyshell = new __1.PythonShell('echo_args.py', {
                args: ['hello', 'world'],
                mode: 'binary'
            });
            pyshell.receive = function () {
                throw new Error('should not emit messages in binary mode');
            };
            pyshell.end(done);
        });
        it('should use a custom parser function', function (done) {
            let pyshell = new __1.PythonShell('echo_text.py', {
                mode: 'text',
                parser: function (message) {
                    return message.toUpperCase();
                }
            });
            let count = 0;
            pyshell.on('message', function (message) {
                count === 0 && message.should.be.exactly('HELLO');
                count === 1 && message.should.be.exactly('WORLD!');
                count++;
            }).on('close', function () {
                count.should.be.exactly(2);
            }).send('hello').send('world!').end(done);
        });
    });
    describe('.receiveStderr(data)', function () {
        it('should emit stderr logs as strings when mode is "text"', function (done) {
            let pyshell = new __1.PythonShell('stderrLogging.py', {
                mode: 'text'
            });
            let count = 0;
            pyshell.on('stderr', function (stderr) {
                count === 0 && stderr.should.be.exactly('INFO:root:Jackdaws love my big sphinx of quartz.');
                count === 1 && stderr.should.be.exactly('DEBUG:log1:Quick zephyrs blow, vexing daft Jim.');
                count++;
            }).on('close', function () {
                count.should.be.exactly(5);
            }).send('hello').send('world').end(done);
        });
        it('should not be invoked when mode is "binary"', function (done) {
            let pyshell = new __1.PythonShell('echo_args.py', {
                args: ['hello', 'world'],
                mode: 'binary'
            });
            pyshell.receiveStderr = function () {
                throw new Error('should not emit stderr in binary mode');
            };
            pyshell.end(done);
        });
        it('should use a custom parser function', function (done) {
            let pyshell = new __1.PythonShell('stderrLogging.py', {
                mode: 'text',
                stderrParser: function (stderr) {
                    return stderr.toUpperCase();
                }
            });
            let count = 0;
            pyshell.on('stderr', function (stderr) {
                count === 0 && stderr.should.be.exactly('INFO:ROOT:JACKDAWS LOVE MY BIG SPHINX OF QUARTZ.');
                count === 1 && stderr.should.be.exactly('DEBUG:LOG1:QUICK ZEPHYRS BLOW, VEXING DAFT JIM.');
                count++;
            }).on('close', function () {
                count.should.be.exactly(5);
            }).send('hello').send('world!').end(done);
        });
    });
    describe('.end(callback)', function () {
        it('should end normally when exit code is zero', function (done) {
            let pyshell = new __1.PythonShell('exit-code.py');
            pyshell.end(function (err, code, signal) {
                if (err)
                    return done(err);
                code.should.be.exactly(0);
                done();
            });
        });
        it('should emit error if exit code is not zero', function (done) {
            let pyshell = new __1.PythonShell('exit-code.py', {
                args: ['3']
            });
            pyshell.on('error', function (err) {
                err.should.have.properties({
                    message: 'process exited with code 3',
                    exitCode: 3
                });
                done();
            });
        });
        it('should emit error when the program exits because of an unhandled exception', function (done) {
            let pyshell = new __1.PythonShell('error.py');
            pyshell.on('error', function (err) {
                err.message.should.be.equalOneOf('ZeroDivisionError: integer division or modulo by zero', 'ZeroDivisionError: division by zero');
                err.should.have.property('traceback');
                err.traceback.should.containEql('Traceback (most recent call last)');
                done();
            });
        });
        it('should NOT emit error when logging is written to stderr', function (done) {
            let pyshell = new __1.PythonShell('stderrLogging.py');
            pyshell.on('error', function (err) {
                done(new Error("an error should not have been raised"));
            });
            pyshell.on('close', function () {
                done();
            });
        });
    });
    describe('.parseError(data)', function () {
        it('should extend error with context properties', function (done) {
            let pyshell = new __1.PythonShell('exit-code.py', {
                args: ['1']
            });
            pyshell.on('error', function (err) {
                err.should.have.properties(['exitCode', 'script', 'options', 'args']);
                done();
            });
        });
        it('should extend err.stack with traceback', function (done) {
            let pyshell = new __1.PythonShell('error.py');
            pyshell.on('error', function (err) {
                err.stack.should.containEql('----- Python Traceback -----');
                err.stack.should.containEql('File "test' + path_1.sep + 'python' + path_1.sep + 'error.py", line 4');
                err.stack.should.containEql('File "test' + path_1.sep + 'python' + path_1.sep + 'error.py", line 6');
                done();
            });
        });
    });
    describe('.terminate()', function () {
        it('set terminated to true', function (done) {
            let pyshell = new __1.PythonShell('infinite_loop.py');
            pyshell.terminate();
            pyshell.terminated.should.be.true;
            done();
        });
        it('run the end callback if specified', function (done) {
            let pyshell = new __1.PythonShell('infinite_loop.py');
            let endCalled = false;
            pyshell.end(() => {
                endCalled = true;
            });
            pyshell.terminate();
            pyshell.terminated.should.be.true;
            done();
        });
        it('terminate with correct kill signal', function (done) {
            let pyshell = new __1.PythonShell('infinite_loop.py');
            let endCalled = false;
            pyshell.end(() => {
                endCalled = true;
            });
            pyshell.terminate('SIGKILL');
            pyshell.terminated.should.be.true;
            setTimeout(() => { pyshell.exitSignal.should.be.exactly('SIGKILL'); }, 500);
            done();
        });
    });
});
//# sourceMappingURL=test-python-shell.js.map