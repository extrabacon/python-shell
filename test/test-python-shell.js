var should = require('should');
var PythonShell = require('..');

describe('PythonShell', function () {

    PythonShell.defaultOptions = {
        scriptPath: './test/python'
    };

    describe('#ctor(script, options)', function () {
        it('should spawn a Python process', function (done) {
            var pyshell = new PythonShell('exit-code.py');
            pyshell.command.should.eql(['test/python/exit-code.py']);
            pyshell.terminated.should.be.false;
            pyshell.end(function (err) {
                if (err) return done(err);
                pyshell.terminated.should.be.true;
                done();
            });
        });
        it('should spawn a Python process with options', function (done) {
            var pyshell = new PythonShell('exit-code.py', {
                pythonOptions: '-u'
            });
            pyshell.command.should.eql(['-u', 'test/python/exit-code.py']);
            pyshell.end(done);
        });
        it('should spawn a Python process with script arguments', function (done) {
            var pyshell = new PythonShell('echo_args.py', {
                args: ['hello', 'world']
            });
            pyshell.command.should.eql(['test/python/echo_args.py', 'hello', 'world']);
            pyshell.end(done);
        });
    });

    describe('#run(script, options)', function () {
        it('should run the script and return output data', function (done) {
            PythonShell.run('echo_args.py', {
                args: ['hello', 'world']
            }, function (err, results) {
                if (err) return done(err);
                results.should.be.an.Array.and.have.lengthOf(2);
                results.should.eql(['hello', 'world']);
                done();
            });
        });
        it('should try to run the script and fail appropriately', function (done) {
            PythonShell.run('unknown_script.py', function (err, results) {
                err.should.be.an.Error;
                err.exitCode.should.be.exactly(2);
                done();
            });
        });
        it('should run the script and fail with an extended stack trace', function (done) {
            PythonShell.run('error.py', function (err, results) {
                err.should.be.an.Error;
                err.exitCode.should.be.exactly(1);
                err.stack.should.containEql('----- Python Traceback -----');
                done();
            });
        });
        it('should run multiple scripts and fail with an extended stack trace for each of them', function (done) {
            var numberOfTimesToRun = 20;
            for (var i = 0; i < numberOfTimesToRun; i++) {
                runSingleErrorScript(end);
            }
            var count = 0;
            function end() {
                count++;
                if (count === numberOfTimesToRun) {
                  done();
                }
            }
            function runSingleErrorScript(callback) {
                PythonShell.run('error.py', function (err, results) {
                    err.should.be.an.Error;
                    err.exitCode.should.be.exactly(1);
                    err.stack.should.containEql('----- Python Traceback -----');
                    callback();
                });
            }
        });

        it('should run multiple scripts and return output data for each of them', function (done) {
            var numberOfTimesToRun = 20;
            for (var i = 0; i < numberOfTimesToRun; i++) {
                runSingleScript(end);
            }
            var count = 0;
            function end() {
                count++;
                if (count === numberOfTimesToRun) {
                  done();
                }
            }
            function runSingleScript(callback) {
                PythonShell.run('echo_args.py', {
                    args: ['hello', 'world']
                }, function (err, results) {
                    if (err) return done(err);
                    results.should.be.an.Array.and.have.lengthOf(2);
                    results.should.eql(['hello', 'world']);
                    callback();
                });
            }

        });
    });

    describe('.send(message)', function () {
        it('should send string messages when mode is "text"', function (done) {
            var pyshell = new PythonShell('echo_text.py', {
                mode: 'text'
            });
            var output = '';
            pyshell.stdout.on('data', function (data) {
                output += ''+data;
            });
            pyshell.send('hello').send('world').end(function (err) {
                if (err) return done(err);
                output.should.be.exactly('hello\nworld\n');
                done();
            });
        });
        it('should send JSON messages when mode is "json"', function (done) {
            var pyshell = new PythonShell('echo_json.py', {
                mode: 'json'
            });
            var output = '';
            pyshell.stdout.on('data', function (data) {
                output += ''+data;
            });
            pyshell.send({ a: 'b' }).send(null).send([1, 2, 3]).end(function (err) {
                if (err) return done(err);
                output.should.be.exactly('{"a": "b"}\nnull\n[1, 2, 3]\n');
                done();
            });
        });
        it('should use a custom formatter', function (done) {
            var pyshell = new PythonShell('echo_text.py', {
                formatter: function (message) {
                    return message.toUpperCase();
                }
            });
            var output = '';
            pyshell.stdout.on('data', function (data) {
                output += ''+data;
            });
            pyshell.send('hello').send('world').end(function (err) {
                if (err) return done(err);
                output.should.be.exactly('HELLO\nWORLD\n');
                done();
            });
        });
        it('should write as-is when mode is "binary"', function (done) {
            var pyshell = new PythonShell('echo_binary.py', {
                mode: 'binary'
            });
            var output = '';
            pyshell.stdout.on('data', function (data) {
                output += ''+data;
            });
            pyshell.send(new Buffer('i am not a string')).end(function (err) {
                if (err) return done(err);
                output.should.be.exactly('i am not a string');
                done();
            });
        });
    });

    describe('.receive(data)', function () {
        it('should emit messages as strings when mode is "text"', function (done) {
            var pyshell = new PythonShell('echo_text.py', {
                mode: 'text'
            });
            var count = 0;
            pyshell.on('message', function (message) {
                count === 0 && message.should.be.exactly('hello');
                count === 1 && message.should.be.exactly('world');
                count++;
            }).on('close', function () {
                count.should.be.exactly(2);
            }).send('hello').send('world').end(done);
        });
        it('should emit messages as JSON when mode is "json"', function (done) {
            var pyshell = new PythonShell('echo_json.py', {
                mode: 'json'
            });
            var count = 0;
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
            var pyshell = new PythonShell('echo_json.py', {
                mode: 'json'
            });
            pyshell.on('message', function (message) {
                message.should.be.an.Object;
                message.should.eql({ a: true });
            }).receive('{"a"').receive(':').receive('true}\n').end(done);
        });
        it('should not be invoked when mode is "binary"', function (done) {
            var pyshell = new PythonShell('echo_args.py', {
                args: ['hello', 'world'],
                mode: 'binary'
            });
            pyshell.receive = function () {
                throw new Error('should not emit messages in binary mode');
            };
            pyshell.end(done);
        });
        it('should use a custom parser function', function (done) {
            var pyshell = new PythonShell('echo_text.py', {
                mode: 'text',
                parser: function (message) {
                    return message.toUpperCase();
                }
            });
            var count = 0;
            pyshell.on('message', function (message) {
                count === 0 && message.should.be.exactly('HELLO');
                count === 1 && message.should.be.exactly('WORLD!');
                count++;
            }).on('close', function () {
                count.should.be.exactly(2);
            }).send('hello').send('world!').end(done);
        });
    });

    describe('.end(callback)', function () {
        it('should end normally when exit code is zero', function (done) {
            var pyshell = new PythonShell('exit-code.py');
            pyshell.end(function (err,code,signal) {
                if (err) return done(err);
                code.should.be.exactly(0);
                done();
            });
        });
        it('should emit error if exit code is not zero', function (done) {
            var pyshell = new PythonShell('exit-code.py', {
                args: 3
            });
            pyshell.on('error', function (err) {
                err.should.have.properties({
                    message: 'process exited with code 3',
                    exitCode: 3
                });
                done();
            });
        });
        it('should emit error when data is written to stderr', function (done) {
            var pyshell = new PythonShell('error.py');
            pyshell.on('error', function (err) {
                err.message.should.be.exactly('ZeroDivisionError: integer division or modulo by zero');
                err.should.have.property('traceback');
                err.traceback.should.containEql('Traceback (most recent call last)');
                done();
            });
        });
    });

    describe('.parseError(data)', function () {
        it('should extend error with context properties', function (done) {
            var pyshell = new PythonShell('exit-code.py', {
                args: 1
            });
            pyshell.on('error', function (err) {
                err.should.have.properties(['exitCode', 'script', 'options', 'args']);
                done();
            });
        });
        it('should extend err.stack with traceback', function (done) {
            var pyshell = new PythonShell('error.py');
            pyshell.on('error', function (err) {
                err.stack.should.containEql('----- Python Traceback -----');
                err.stack.should.containEql('File "test/python/error.py", line 6');
                err.stack.should.containEql('File "test/python/error.py", line 4');
                done();
            });
        });
    });

    describe('.terminate()', function () {
        it('set terminated to true', function (done) {
            var pyshell = new PythonShell('infinite_loop.py');
            pyshell.terminate();
            pyshell.terminated.should.be.true
            done();
        });
        it('run the end callback if specified', function (done) {
            var pyshell = new PythonShell('infinite_loop.py');
            var endCalled = false;
            pyshell.end(()=>{
                endCalled = true;
            })
            pyshell.terminate();
            pyshell.terminated.should.be.true
            done();
        });
        it('terminate with correct kill signal', function (done) {
            var pyshell = new PythonShell('infinite_loop.py');
            var endCalled = false;
            pyshell.end(()=>{
                endCalled = true;
            })
            pyshell.terminate('SIGKILL');
            pyshell.terminated.should.be.true;
            setTimeout(()=>{pyshell.exitSignal.should.be.exactly('SIGKILL');},500);
            done();
        });
    });
});
