"""Server di sviluppo per Taranto Futura.

Uguale a `python -m http.server`, ma vieta al browser di tenere in cache i
file. Senza questo, modificando CSS o JS il browser continua a servire la
versione vecchia e sembra che le modifiche non abbiano effetto.

Uso:  python tools/dev-server.py [porta]
"""
import sys
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class NoCacheHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write('%s\n' % (fmt % args))


if __name__ == '__main__':
    srv = ThreadingHTTPServer(('127.0.0.1', PORT), NoCacheHandler)
    print('Taranto Futura - sviluppo su http://localhost:%d  (cache disattivata)' % PORT)
    print('cartella: %s' % ROOT)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        srv.shutdown()
