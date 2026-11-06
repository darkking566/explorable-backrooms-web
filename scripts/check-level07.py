"""Local Chromium integration checks; uses the already-installed Playwright package.
Runs an isolated browser and loopback HTTP server. Does not touch user's browser.
"""
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
import json
import re
import subprocess
import threading
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs' / 'level0_7' / 'evidence'
OUT.mkdir(parents=True, exist_ok=True)

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *args): pass

server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
url = f'http://127.0.0.1:{server.server_port}'
report = {'url': url, 'checks': [], 'errors': [], 'screenshots': []}
def check(name, result):
    report['checks'].append({'name': name, 'result': result})
    print(name, json.dumps(result, ensure_ascii=True), flush=True)
    assert result is True or isinstance(result, dict) and result.get('pass'), name

def resume(page):
    page.wait_for_timeout(1100)
    if not page.evaluate('document.pointerLockElement === renderer.domElement'):
        page.mouse.click(640,360)
    page.wait_for_function('document.pointerLockElement === renderer.domElement',timeout=5000)

try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe', args=['--use-angle=d3d11'])
        page = browser.new_page(viewport={'width':1280,'height':720}, device_scale_factor=1)
        page.on('pageerror', lambda e: report['errors'].append(str(e)))
        page.goto(url, wait_until='networkidle', timeout=60000)
        page.wait_for_function("typeof Memory07 !== 'undefined' && typeof keys !== 'undefined'", timeout=30000)
        check('boot', len(report['errors']) == 0)
        check('layout', page.evaluate('''() => {
          const l=Memory07.layout, seen=new Set([5*l.COLS]), q=[5*l.COLS];
          for(let n=0;n<q.length;n++)for(const next of l.neighbors(q[n]))if(!seen.has(next)){seen.add(next);q.push(next);}
          const safe=l.cells.every(c=>l.pointInCell(c.i,c.j));
          return {pass:seen.size===l.COLS*l.ROWS&&safe,cells:l.cells.length,connected:seen.size,safe};
        }'''))
        page.evaluate('Memory07.enter()')
        check('build', page.evaluate('Memory07.inspect().built'))
        page.locator('#ov').click()
        check('pointer_lock', page.evaluate('document.pointerLockElement === renderer.domElement'))
        report['gpu'] = page.evaluate('''() => {const gl=renderer.getContext(),e=gl.getExtension('WEBGL_debug_renderer_info');return e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);}''')
        print('gpu',report['gpu'],flush=True)
        # Use a frozen clock snapshot for six reproducible visual checkpoints.
        for era in range(6):
            page.evaluate('''e => {
              const l=Memory07.layout,pt=l.pointInCell(e*l.PER+5,5);
              P.x=pt[0];P.z=pt[1];P.yaw=e===4?-.5:Math.PI/2;P.pitch=e===4?.15:0;
              Memory07.onTeleport();
            }''', era)
            page.wait_for_function('e=>Memory07.inspect().era===e', arg=era)
            page.wait_for_timeout(500)
            path=OUT / f'era-{era}.png';page.screenshot(path=str(path));report['screenshots'].append(str(path.relative_to(ROOT)))
        # Real key actions exercise file UI and pause.
        page.keyboard.press('j')
        check('reader_opens', page.locator('#memoryReader').is_visible())
        before=page.evaluate('Memory07.inspect()')
        page.wait_for_timeout(700)
        after=page.evaluate('Memory07.inspect()')
        check('reader_pauses_survival', before['water']==after['water'] and before['fatigue']==after['fatigue'])
        check('archive_loaded', page.frame_locator('#memoryReader iframe').locator('main').count()==1)
        page.screenshot(path=str(OUT/'reader.png'))
        page.keyboard.press('Escape')
        resume(page)
        # Sleep goes through the actual input and transition timer.
        page.keyboard.press('f')
        check('sleep_starts',page.evaluate('Memory07.inspect().transition === "sleep"'))
        page.wait_for_function('Memory07.inspect().transition === null',timeout=15000)
        check('sleep_lands_on_floor',page.evaluate('Memory07.stand(P.x,P.z)'))
        # Both map route and normal passage use the same safe stand predicate.
        page.keyboard.press('m')
        check('map_opens',page.locator('#map').is_visible())
        check('map_has_level07',page.locator('[data-m="memory"]').count()==1)
        map_materials=page.evaluate('[...new Set(mapWorld.children.map(m=>m.material.uuid))].sort()')
        for _ in range(5):
            page.evaluate('buildMap()')
        check('map_reuses_materials',map_materials==page.evaluate('[...new Set(mapWorld.children.map(m=>m.material.uuid))].sort()'))
        page.screenshot(path=str(OUT/'map.png'))
        page.keyboard.press('m')
        resume(page)
        check('four_entity_types',page.evaluate('new Set(Memory07.inspect().creatures.map(c=>c.kind)).size===4'))
        # Scene changes hide the old group, and returning resets per-trip hazards.
        page.evaluate('Memory07.leave()')
        check('return_level0',page.evaluate('mode === "map" && P.x >= 0 && P.x <= WS && P.z >= 0 && P.z <= DS'))
        page.evaluate('Memory07.enter()')
        check('trip_reset',page.evaluate('Memory07.inspect().water >= 99.9 && Memory07.inspect().fireCount === 0'))
        check('main_route_physically_open',page.evaluate('''() => {const l=Memory07.layout,z=l.center(0,5)[1];for(let x=l.X0+.5;x<l.X0+l.WIDTH-.5;x+=.4)if(!l.clear(x,z,.31))return false;return true;}'''))
        # The closest action must be usable from the clear side of its physical table/plinth.
        check('relic_interaction',page.evaluate('''() => {const l=Memory07.layout,a=l.actions.find(a=>a.e===1&&a.tip.includes('攜帶'));P.x=a.x;P.z=a.z-1.1;Memory07.key('KeyE');return Memory07.inspect().relic===1;}'''))
        check('archive_interaction',page.evaluate('''() => {const l=Memory07.layout,a=l.actions.find(a=>a.e===2&&a.tip.includes('完整層級'));P.x=a.x;P.z=a.z-1.1;Memory07.key('KeyE');return !document.querySelector('#memoryReader').hidden&&Memory07.inspect().read.includes('records');}'''))
        page.keyboard.press('Escape');resume(page)
        check('fire_interaction',page.evaluate('''() => {const l=Memory07.layout,a=l.actions.find(a=>a.e===1&&a.tip.includes('挪動'));P.x=a.x;P.z=a.z-1.1;Memory07.key('KeyE');return Memory07.inspect().fireCount===1;}'''))
        before_health=page.evaluate('Memory07.inspect().health')
        page.wait_for_timeout(1600)
        check('fire_damage',page.evaluate('Memory07.inspect().health')<before_health)
        page.wait_for_function('Memory07.inspect().transition === "failure"',timeout=25000)
        check('failure_transition',page.evaluate('state === "wait"'))
        page.wait_for_function('Memory07.inspect().transition === null && Memory07.inspect().health > 95',timeout=12000)
        check('failure_keeps_reading',page.evaluate('Memory07.inspect().read.includes("records") && Memory07.inspect().water > 99'))
        page.evaluate('Memory07.leave();P.x=.25;P.z=5.5*S;P.yaw=Math.PI/2;P.pitch=0;')
        page.keyboard.down('w');page.wait_for_timeout(700);page.keyboard.up('w')
        check('walking_entry',page.evaluate('mode === "memory"'))
        page.evaluate('P.x=Memory07.layout.X0+.5;P.z=Memory07.layout.center(0,5)[1];P.yaw=Math.PI/2;')
        page.keyboard.down('w');page.wait_for_timeout(700);page.keyboard.up('w')
        check('walking_return',page.evaluate('mode === "map"'))
        page.evaluate('Memory07.enter()')
        for kind in ['hound','faceling','skin','growler']:
            check(kind+'_test_position',page.evaluate('''kind=>{
              Memory07.onTeleport();const l=Memory07.layout,c=Memory07.inspect().creatures.find(c=>c.kind===kind);
              for(let n=0;n<32;n++){const a=n*Math.PI/16,x=c.x+Math.cos(a)*3.8,z=c.z+Math.sin(a)*3.8;if(!l.clear(x,z,.5))continue;let ok=true;for(let f=.1;f<=1;f+=.1)if(!l.clear(c.x+(x-c.x)*f,c.z+(z-c.z)*f,.06))ok=false;if(!ok)continue;P.x=x;P.z=z;P.yaw=Math.atan2(x-c.x,z-c.z);P.pitch=0;Memory07.onTeleport();return true;}return false;
            }''',kind))
            page.wait_for_timeout(650)
            check(kind+'_reacts',page.evaluate('kind=>Memory07.inspect().creatures.find(c=>c.kind===kind).alert>0',kind))
            check(kind+'_clear_of_walls',page.evaluate('kind=>{const c=Memory07.inspect().creatures.find(c=>c.kind===kind);return Memory07.layout.clear(c.x,c.z,.2);}',kind))
            page.screenshot(path=str(OUT/('entity-'+kind+'.png')))
        # Record actual frame intervals and whole-frame draw counts on the same machine.
        page.evaluate('Memory07.enter();const pt=Memory07.layout.pointInCell(53,5);P.x=pt[0];P.z=pt[1];Memory07.onTeleport();')
        page.wait_for_timeout(700)
        performance_script='''() => new Promise(resolve=>{
          const values=[],draws=[];let last=performance.now(),n=0;renderer.info.autoReset=false;
          function sample(now){if(n++>5){values.push(now-last);draws.push(renderer.info.render.calls);}last=now;renderer.info.reset();if(n<36)requestAnimationFrame(sample);else{renderer.info.autoReset=true;values.sort((a,b)=>a-b);resolve({viewport:[innerWidth,innerHeight],pixelRatio:renderer.getPixelRatio(),frames:values.length,medianMs:values[Math.floor(values.length/2)],p95Ms:values[Math.floor(values.length*.95)],meanDrawCalls:draws.reduce((a,b)=>a+b,0)/draws.length});}}requestAnimationFrame(sample);
        })'''
        report['performance']=page.evaluate(performance_script)
        report['comparison']={}
        for label, command in [('level0','Memory07.leave()'),('level0_3','enterIce()'),('level0_2','enterRemodel()')]:
            page.evaluate(command)
            page.wait_for_timeout(900)
            report['comparison'][label]=page.evaluate(performance_script)
        check('runtime_errors',len(report['errors'])==0)
        report['renderer']=page.evaluate('({geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,programs:renderer.info.programs.length,pixelRatio:renderer.getPixelRatio()})')
        browser.close()
finally:
    server.shutdown()
    (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
