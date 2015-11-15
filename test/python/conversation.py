import sys, json

def is_json(myjson):
    try:
        json_object = json.loads(myjson)
    except ValueError, e:
        return False
    return True

def makeError(reason):
	return {
		'action': 'error',
		'reason': reason
	}

def handleKnockKnock(obj):
	response = {
		'action': 'knockknockjoke'
	};

	phase = obj['phase'];
	if (phase == 'Knock, knock.'):
		response.message = "Who's there?"
		return response;

	if (phase == 'Orange.'):
		response.message = "Orange who?"
		return response;

	if (phase == "Orange you glad I didn't say, 'banana'?"):
		response.message = "Ha ha."
		return response;

	return makeError('Unrecognised knock-knock phase.')

def handleAction(obj):
	if 'action' not in obj:
		return makeError("Unsupported input; expected 'action' key.")
	
	action = obj['action']
	if action == 'knockknockjoke':
		return handleKnockKnock(obj)

	return makeError("Unrecognised action: {0}".format(action))

def handleLine(line):
	if not is_json(line):
		return makeError('Malformed input could not be parsed as JSON: {0}'.format(line))

	parsed = json.loads(line)

	if type (parsed) != type({}):
		return makeError('Malformed input: expected JSON object; received JSON primitive instead: {0}'.format(parsed))
		
	return handleAction(parsed)

# simple JSON echo script
for line in sys.stdin:
	response = handleLine(line)

	print json.dumps(response)
