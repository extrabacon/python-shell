# [python-shell](https://www.npmjs.com/package/python-shell) [![Build status](https://ci.appveyor.com/api/projects/status/m8e3h53vvxg5wb2q?svg=true)](https://ci.appveyor.com/project/Almenon/python-shell) [![codecov](https://codecov.io/gh/extrabacon/python-shell/branch/master/graph/badge.svg)](https://codecov.io/gh/extrabacon/python-shell)

<!-- chage above url accroding to repo -->
A simple way to run Python scripts from Node.js with basic but efficient inter-process communication and better error handling.

## Features

+ Reliably spawn Python scripts in a child process
+ Built-in text, JSON and binary modes
+ Custom parsers and formatters
+ Simple and efficient data transfers through stdin and stdout streams
+ Extended stack traces when an error is thrown

## Installation

```bash
npm install python-shell
```

To run the tests:
```bash
npm test
```

## Documentation

### Running python code:

```typescript
import {PythonShell} from 'python-shell';

PythonShell.runString('x=1+1;print(x)', null, function (err) {
  if (err) throw err;
  console.log('finished');
});
```

If the script exits with a non-zero code, an error will be thrown.

Note the use of imports! If you're not using typescript ಠ_ಠ you can [still get imports to work with this guide](https://github.com/extrabacon/python-shell/issues/148#issuecomment-419120209).

Or you can use require like so: 
```javascript
let {PythonShell} = require('python-shell')
```

### Running a Python script:

```typescript
import {PythonShell} from 'python-shell';

PythonShell.run('my_script.py', null, function (err) {
  if (err) throw err;
  console.log('finished');
});
```

If the script exits with a non-zero code, an error will be thrown.

### Running a Python script with arguments and options:

```typescript
import {PythonShell} from 'python-shell';

let options = {
  mode: 'text',
  pythonPath: 'path/to/python',
  pythonOptions: ['-u'], // get print results in real-time
  scriptPath: 'path/to/my/scripts',
  args: ['value1', 'value2', 'value3']
};

PythonShell.run('my_script.py', options, function (err, results) {
  if (err) throw err;
  // results is an array consisting of messages collected during execution
  console.log('results: %j', results);
});
```

### Exchanging data between Node and Python:

```typescript
import {PythonShell} from 'python-shell';
let pyshell = new PythonShell('my_script.py');

// sends a message to the Python script via stdin
pyshell.send('hello');

pyshell.on('message', function (message) {
  // received a message sent from the Python script (a simple "print" statement)
  console.log(message);
});

// end the input stream and allow the process to exit
pyshell.end(function (err,code,signal) {
  if (err) throw err;
  console.log('The exit code was: ' + code);
  console.log('The exit signal was: ' + signal);
  console.log('finished');
  console.log('finished');
});
```

Use `.send(message)` to send a message to the Python script. Attach the `message` event to listen to messages emitted from the Python script.

Use `options.mode` to quickly setup how data is sent and received between your Node and Python applications.

  * use `text` mode for exchanging lines of text
  * use `json` mode for exchanging JSON fragments
  * use `binary` mode for anything else (data is sent and received as-is)

For more details and examples including Python source code, take a look at the tests.

### Error Handling and extended stack traces

An error will be thrown if the process exits with a non-zero exit code. Additionally, if "stderr" contains a formatted Python traceback, the error is augmented with Python exception details including a concatenated stack trace.

Sample error with traceback (from test/python/error.py):

```
Traceback (most recent call last):
  File "test/python/error.py", line 6, in <module>
    divide_by_zero()
  File "test/python/error.py", line 4, in divide_by_zero
    print 1/0
ZeroDivisionError: integer division or modulo by zero
```

would result into the following error:

```typescript
{ [Error: ZeroDivisionError: integer division or modulo by zero]
  traceback: 'Traceback (most recent call last):\n  File "test/python/error.py", line 6, in <module>\n    divide_by_zero()\n  File "test/python/error.py", line 4, in divide_by_zero\n    print 1/0\nZeroDivisionError: integer division or modulo by zero\n',
  executable: 'python',
  options: null,
  script: 'test/python/error.py',
  args: null,
  exitCode: 1 }
```

and `err.stack` would look like this:

```
Error: ZeroDivisionError: integer division or modulo by zero
    at PythonShell.parseError (python-shell/index.js:131:17)
    at ChildProcess.<anonymous> (python-shell/index.js:67:28)
    at ChildProcess.EventEmitter.emit (events.js:98:17)
    at Process.ChildProcess._handle.onexit (child_process.js:797:12)
    ----- Python Traceback -----
    File "test/python/error.py", line 6, in <module>
      divide_by_zero()
    File "test/python/error.py", line 4, in divide_by_zero
      print 1/0
```

## API Reference

#### `PythonShell(script, options)` constructor

Creates an instance of `PythonShell` and starts the Python process

* `script`: the path of the script to execute
* `options`: the execution options, consisting of:
  * `mode`: Configures how data is exchanged when data flows through stdin and stdout. The possible values are:
    * `text`: each line of data (ending with "\n") is emitted as a message (default)
    * `json`: each line of data (ending with "\n") is parsed as JSON and emitted as a message
    * `binary`: data is streamed as-is through `stdout` and `stdin`
  * `formatter`: each message to send is transformed using this method, then appended with "\n"
  * `parser`: each line of data (ending with "\n") is parsed with this function and its result is emitted as a message
  * `stderrParser`: each line of logs (ending with "\n") is parsed with this function and its result is emitted as a message
  * `encoding`: the text encoding to apply on the child process streams (default: "utf8")
  * `pythonPath`: The path where to locate the "python" executable. Default: "python"
  * `pythonOptions`: Array of option switches to pass to "python"
  * `scriptPath`: The default path where to look for scripts. Default is the current working directory.
  * `args`: Array of arguments to pass to the script

Other options are forwarded to `child_process.spawn`.

PythonShell instances have the following properties:
* `script`: the path of the script to execute
* `command`: the full command arguments passed to the Python executable
* `stdin`: the Python stdin stream, used to send data to the child process
* `stdout`: the Python stdout stream, used for receiving data from the child process
* `stderr`: the Python stderr stream, used for communicating logs & errors
* `childProcess`: the process instance created via `child_process.spawn`
* `terminated`: boolean indicating whether the process has exited
* `exitCode`: the process exit code, available after the process has ended

Example:

```typescript
// create a new instance
let shell = new PythonShell('script.py', options);
```

#### `#defaultOptions`

Configures default options for all new instances of PythonShell.

Example:

```typescript
// setup a default "scriptPath"
PythonShell.defaultOptions = { scriptPath: '../scripts' };
```

#### `#run(script, options, callback)`

Runs the Python script and invokes `callback` with the results. The callback contains the execution error (if any) as well as an array of messages emitted from the Python script.

This method is also returning the `PythonShell` instance.

Example:

```typescript
// run a simple script
PythonShell.run('script.py', null, function (err, results) {
  // script finished
});
```

#### `#runString(code, options, callback)`

Runs the Python code and invokes `callback` with the results. The callback contains the execution error (if any) as well as an array of messages emitted from the Python script.

This method is also returning the `PythonShell` instance.

Example:

```typescript
// run a simple script
PythonShell.runString('x=1;print(x)', null, function (err, results) {
  // script finished
});
```

#### `#checkSyntax(code:string)`

Checks the syntax of the code and returns a promise.
Promise is rejected if there is a syntax error.

#### `#checkSyntaxFile(filePath:string)`

Checks the syntax of the file and returns a promise.
Promise is rejected if there is a syntax error.

#### `#getVersion(pythonPath?:string)`

Returns the python version. Optional pythonPath param to get the version 
of a specific python interpreter.

#### `#getVersionSync(pythonPath?:string)`

Returns the python version. Optional pythonPath param to get the version 
of a specific python interpreter.

#### `.send(message)`

Sends a message to the Python script via stdin. The data is formatted according to the selected mode (text or JSON), or through a custom function when `formatter` is specified.

Example:

```typescript
// send a message in text mode
let shell = new PythonShell('script.py', { mode: 'text '});
shell.send('hello world!');

// send a message in JSON mode
let shell = new PythonShell('script.py', { mode: 'json '});
shell.send({ command: "do_stuff", args: [1, 2, 3] });
```

#### `.receive(data)`

Parses incoming data from the Python script written via stdout and emits `message` events. This method is called automatically as data is being received from stdout.

#### `.receiveStderr(data)`

Parses incoming logs from the Python script written via stderr and emits `stderr` events. This method is called automatically as data is being received from stderr.

#### `.end(callback)`

Closes the stdin stream, allowing the Python script to finish and exit. The optional callback is invoked when the process is terminated.

#### `.terminate(signal)`

Terminates the python script, the optional end callback is invoked if specified. A kill signal may be provided by `signal`, if `signal` is not specified SIGTERM is sent.

#### event: `message`

Fires when a chunk of data is parsed from the stdout stream via the `receive` method. If a `parser` method is specified, the result of this function will be the message value. This event is not emitted in binary mode.

Example:

```typescript
// receive a message in text mode
let shell = new PythonShell('script.py', { mode: 'text '});
shell.on('message', function (message) {
  // handle message (a line of text from stdout)
});

// receive a message in JSON mode
let shell = new PythonShell('script.py', { mode: 'json '});
shell.on('message', function (message) {
  // handle message (a line of text from stdout, parsed as JSON)
});
```

#### event: `stderr`

Fires when a chunk of logs is parsed from the stderr stream via the `receiveStderr` method. If a `stderrParser` method is specified, the result of this function will be the message value. This event is not emitted in binary mode.

Example:

```typescript
// receive a message in text mode
let shell = new PythonShell('script.py', { mode: 'text '});
shell.on('stderr', function (stderr) {
  // handle stderr (a line of text from stderr)
});
```

#### event: `close`

Fires when the process has been terminated, with an error or not.

#### event: `error`

Fires when the process terminates with a non-zero exit code.

## Used By:

Python-Shell is used by [arepl-vscode](https://github.com/almenon/arepl-vscode), [gitinspector](https://github.com/ejwa/gitinspector), [pyspreadsheet](https://github.com/extrabacon/pyspreadsheet), and more!

## License

The MIT License (MIT)

Copyright (c) 2014 Nicolas Mercier

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
