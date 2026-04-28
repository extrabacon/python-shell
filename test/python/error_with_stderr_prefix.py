import sys

sys.stderr.write('prefix log before traceback\n')


def fail():
    raise Exception('Error sample')


fail()
