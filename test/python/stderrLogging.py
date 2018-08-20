# logging example taken from https://docs.python.org/3/howto/logging-cookbook.html
# Note that logging logs to stderr by default

import logging

# set up logging to file - see previous section for more details
logging.basicConfig(level=logging.DEBUG)

# Now, we can log to the root logger, or any other logger. First the root...
logging.info('Jackdaws love my big sphinx of quartz.')

# Now, define a couple of other loggers which might represent areas in your
# application:

logger1 = logging.getLogger('log1')
logger2 = logging.getLogger('log2')

logger1.debug('Quick zephyrs blow, vexing daft Jim.')
logger1.info('How quickly daft jumping zebras vex.')
logger2.warning('Jail zesty vixen who grabbed pay from quack.')
logger2.error('The five boxing wizards jump quickly.')