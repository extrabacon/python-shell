import sys, json

def makeError(reason):
	return {
		action: 'error',
		reason: reason
	}

def handleKnockKnock(obj):
	response = {
		action: 'knockknockjoke'
	};

	phase = obj.phase;
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
	action = obj.action
	if action == 'knockknockjoke':
		return handleKnockKnock(obj)

	return makeError("Unrecognised action: {0}".format(action))

# simple JSON echo script
for line in sys.stdin:
	parsed = json.loads(line)
	response = handleAction(parsed)
	print json.dumps(response)
