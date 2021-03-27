import sys, json, os

for line in sys.stdin:
  line = line.replace('$', os.linesep)
  print(line[:-1], end='')
