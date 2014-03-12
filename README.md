# python-shell

A simple way to run Python scripts from Node.js with basic but efficient inter-process communication through stdio.

## Features

+ Reliably spawn Python scripts in a child process
+ Text, JSON and binary modes
+ Simple and efficient data transfers through stdin and stdout streams
+ Extended stack traces in case an exception is thrown

## Installation

```bash
npm install python-shell
```

To run the tests:
```bash
npm test
```

## Documentation

### Running a Python script:

```js
PythonShell.run('my_script.py', function (err) {
  if (err) throw err;
  console.log('finished');
});
```

If the script writes to stderr or exits with a non-zero code, an error will be thrown.

### Running a Python script with arguments and options:

```js
var options = {
  mode: 'text',
  pythonPath: 'path/to/python',
  pythonOptions: ['-u'],
  scriptPath: 'path/to/my/scripts',
  args: ['value1', 'value2', 'value3']
};

PythonShell.run('my_script.py', options, function (err) {
  if (err) throw err;
});
```

The options are:

* `mode`: Configures how data is exchanged between the child process and its parent. The possible values are:
  * `text`: each line of data (ending with "\n") is emitted as a message (default)
  * `json`: each line of data (ending with "\n") is parsed as JSON and emitted as a message
  * `binary`: data is streamed as-is through `stdout` nd `stdin`
* `pythonPath`: The path where to locate the "python" executable. Default: "python"
* `pythonOptions`: Array of option switches to pass to "python"
* `scriptPath`: The default path where to look for scripts. Default: "./python"
* `args`: Array of arguments to pass to the script

Other options are forwarded to `child_process.spawn`.

### Exchanging data between Node and Python:

```js
var pyshell = new PythonShell('my_script.py');

// send a message to the Python script via stdin
pyshell.send('hello');

pyshell.on('message', function (message) {
  // received a message emitted from the script via stdout
  console.log(message);
});

// end the input stream and allow the process to exit
pyshell.end(function (err) {
  if (err) throw err;
  console.log('finished');
});
```

Use `.send(message)` to send a message to the Python script. Attach the `message` event to listen to messages emitted from the Python script.

For more details and examples, take a look at the unit tests.

### Error Handling and extended stack traces

An error will be thrown if the process exits with a non-zero exit code or if data has been written to stderr. Additionally, if "stderr" contains a standard Python traceback, the error is augmented with Python exception details including a concatenated stack trace.

Example error with traceback (from test/python/error.py):
```
Traceback (most recent call last):
  File "test/python/error.py", line 6, in <module>
    divide_by_zero()
  File "test/python/error.py", line 4, in divide_by_zero
    print 1/0
ZeroDivisionError: integer division or modulo by zero
```
would result into:
```js
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
