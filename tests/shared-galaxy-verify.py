#!/usr/bin/env python3
"""Real-browser verification of the THIÊN HÀ CHUNG scene (Playwright + Chromium).

Usage (dev server already running):
    python3 tests/shared-galaxy-verify.py [--url http://127.0.0.1:4173/] [--out verification/shared-galaxy/screenshots]

It drives the real page, not a mock: it opens #/galaxy, measures pixel change between
frames, forces each cosmic event, traces the comet lifecycle, clicks every galaxy and
lists every visible text node. Results are written to <out>/results.json.
Software WebGL (SwiftShader) is slow, so the viewport is modest; the logic under test
is resolution independent.
"""
import argparse, asyncio, base64, io, json, os, time
import numpy as np
from PIL import Image
from playwright.async_api import async_playwright

ap = argparse.ArgumentParser()
ap.add_argument('--url', default='http://127.0.0.1:4173/')
ap.add_argument('--out', default='verification/shared-galaxy/screenshots')
ap.add_argument('--width', type=int, default=800)
ap.add_argument('--height', type=int, default=500)
ap.add_argument('--observe', type=float, default=32.0)
args = ap.parse_args()
os.makedirs(args.out, exist_ok=True)
R = {}
LAUNCH = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]


async def shot(ctx, pg, name):
    cdp = await ctx.new_cdp_session(pg)
    r = await asyncio.wait_for(cdp.send("Page.captureScreenshot", {"format": "png"}), 90)
    raw = base64.b64decode(r["data"])
    open(os.path.join(args.out, name + '.png'), 'wb').write(raw)
    await cdp.detach()
    return np.asarray(Image.open(io.BytesIO(raw)).convert('RGB')).astype(int)


def diff_stats(a, b, mask=None):
    d = np.abs(a - b).sum(axis=2)
    if mask is not None:
        d = d[mask]
    return {"changed_pct": round(float((d > 30).mean() * 100), 2), "mean_abs": round(float(d.mean()), 2)}


def disk_mask(h, w, cx, cy, r):
    yy, xx = np.ogrid[:h, :w]
    return (xx - cx) ** 2 + (yy - cy) ** 2 <= r * r


async def diag(pg):
    return await pg.evaluate("window.STELLAR.sharedGalaxy.impl.getDiagnostics()")


async def open_galaxy(browser, w, h, mobile=False):
    ctx = await browser.new_context(viewport={"width": w, "height": h}, has_touch=mobile, is_mobile=mobile)
    await ctx.route("**/fonts.g*apis.com/**", lambda r: r.abort())
    pg = await ctx.new_page()
    logs = []
    pg.on("console", lambda m: logs.append(f"{m.type}: {m.text[:300]}"))
    pg.on("pageerror", lambda e: logs.append("PAGEERROR " + str(e)[:300]))
    await pg.goto(args.url, wait_until="commit")
    await asyncio.sleep(3)
    await pg.evaluate("location.hash='#/galaxy'")
    await asyncio.sleep(5)
    return ctx, pg, logs


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=LAUNCH)
        W, H = args.width, args.height
        ctx, pg, logs = await open_galaxy(browser, W, H)
        d0 = await diag(pg)
        R['renderer'] = await pg.evaluate("window.STELLAR.sharedGalaxy.renderer")
        R['viewport'] = [W, H]

        # ---- A. internal motion only: camera frozen, scheduled events disabled -------
        await pg.evaluate("""(()=>{const g=window.STELLAR.sharedGalaxy.impl;
          g.updateCamera=()=>{}; g.scheduler.update=()=>({finished:null,started:null});
          g.director.end(g.elapsed); g.comet.stop(); g.pointer.x=-1000;})()""")
        await asyncio.sleep(1.0)
        fa = await shot(ctx, pg, 'A0_frozen_camera_t0')
        da = await diag(pg)
        await pg.evaluate("(()=>{const g=window.STELLAR.sharedGalaxy.impl; for(let i=0;i<60;i++) g.advance(0.05);})()")
        await asyncio.sleep(1.5)
        fb = await shot(ctx, pg, 'A1_frozen_camera_t+3s')
        await pg.evaluate("(()=>{const g=window.STELLAR.sharedGalaxy.impl; for(let i=0;i<60;i++) g.advance(0.05);})()")
        await asyncio.sleep(1.5)
        fc = await shot(ctx, pg, 'A2_frozen_camera_t+6s')
        db = await diag(pg)
        h, w = fa.shape[:2]
        per = []
        for gdat, gb in zip(da['galaxies'], db['galaxies']):
            m = disk_mask(h, w, gdat['x'], gdat['y'], max(20, gdat['r'] * 0.9))
            per.append({"id": gdat['id'], "r_px": round(gdat['r']), "t0_to_t3": diff_stats(fa, fb, m), "t0_to_t6": diff_stats(fa, fc, m),
                        "uTime": [round(gdat['uTime'], 2), round(gb['uTime'], 2)]})
        R['A_internal_motion'] = {"whole_frame_t3": diff_stats(fa, fb), "whole_frame_t6": diff_stats(fa, fc), "per_galaxy": per,
                                  "distinct_galaxy_clocks": len({round(x['uTime'][1] % 1, 3) for x in per})}
        # Space *between* galaxies (matter bridges): mask = outside every galaxy disk.
        between = np.ones((h, w), bool)
        for gdat in da['galaxies']:
            between &= ~disk_mask(h, w, gdat['x'], gdat['y'], gdat['r'] * 1.15)
        R['A_internal_motion']['between_galaxies_t3'] = diff_stats(fa, fb, between)

        # ---- B. each cosmic event, forced, with its own camera/clock -----------------
        # Re-enable normal updates by reloading a fresh page.
        await ctx.close()
        ctx, pg, logs2 = await open_galaxy(browser, W, H)
        await pg.evaluate("(()=>{const g=window.STELLAR.sharedGalaxy.impl; g.scheduler.update=()=>({finished:null,started:null}); g.pointer.x=-1000;})()")
        base = await shot(ctx, pg, 'B_event_baseline')
        events = {}
        for kind, galaxy in [('armWave', 2), ('cascade', 8), ('starburst', 4), ('dustStream', 5), ('nebulaBloom', 0), ('convergence', 5), ('comet', 1)]:
            await pg.evaluate(f"""(()=>{{const g=window.STELLAR.sharedGalaxy.impl; g.director.end(g.elapsed); g.comet.stop();
              g.triggerEvent('{kind}', {galaxy}); for(let i=0;i<14;i++) g.advance(0.05);}})()""")
            await asyncio.sleep(1.2)
            f = await shot(ctx, pg, f'B_event_{kind}')
            d = await diag(pg)
            events[kind] = {"vs_baseline": diff_stats(base, f), "comet_active": d['cometActive'], "bridge_pulses": d['bridgePulses'],
                            "max_flare": round(max(x['flare'] for x in d['galaxies']), 2), "max_nova": round(max(x['nova'] for x in d['galaxies']), 2)}
        R['B_events'] = events

        # ---- C. comet lifecycle -------------------------------------------------------
        trace = await pg.evaluate("""(()=>{const g=window.STELLAR.sharedGalaxy.impl;
          g.director.end(g.elapsed); g.comet.stop(); g.triggerEvent('comet', 3);
          const out=[]; let t=0; const cam=g.camera;
          const v=new g.camera.position.constructor();
          while(t<7){ g.advance(0.1); t+=0.1; const c=g.comet;
            v.copy(c.head).project(cam);
            out.push({t:+t.toFixed(1), active:c.active, sx:+((v.x*0.5+0.5)*innerWidth).toFixed(0), sy:+((-v.y*0.5+0.5)*innerHeight).toFixed(0), prog:+c.progress.toFixed(2), hits:Array.from(c.hit).reduce((a,b)=>a+b,0)});}
          return out;})()""")
        active = [x for x in trace if x['active']]
        R['C_comet_lifecycle'] = {
            "duration_s": round(active[-1]['t'] if active else 0, 1),
            "starts_outside_view": bool(active and (active[0]['sx'] < 0 or active[0]['sx'] > W or active[0]['sy'] < 0 or active[0]['sy'] > H)),
            "screen_distance_px": round(float(np.hypot(active[-1]['sx'] - active[0]['sx'], active[-1]['sy'] - active[0]['sy']))) if active else 0,
            "galaxies_reacted": max((x['hits'] for x in trace), default=0),
            "ended": not trace[-1]['active'], "samples": [trace[i] for i in range(0, len(trace), 6)]}

        # ---- D. real-time observation ---------------------------------------------------
        await ctx.close()
        ctx, pg, logs3 = await open_galaxy(browser, W, H)
        t_wall0 = time.time()
        d_start = await diag(pg)
        frames = []
        k = 0
        while time.time() - t_wall0 < args.observe:
            f = await shot(ctx, pg, f'D_realtime_{k:02d}')
            d = await diag(pg)
            frames.append((time.time() - t_wall0, f, d))
            k += 1
        seq = []
        for i in range(1, len(frames)):
            seq.append({"wall_s": round(frames[i][0], 1), "sim_s": round(frames[i][2]['elapsed'], 2), "frames": frames[i][2]['frames'],
                        "event": (frames[i][2]['activeEvent'] or {}).get('kind'), "vs_first": diff_stats(frames[0][1], frames[i][1]),
                        "vs_prev": diff_stats(frames[i - 1][1], frames[i][1])})
        dend = await diag(pg)
        R['D_realtime'] = {"wall_seconds": round(time.time() - t_wall0, 1), "captures": len(frames), "render_frames": dend['frames'],
                           "sim_seconds": round(dend['elapsed'], 2), "events_started": [e for e in dend['history']],
                           "quality_end": dend['quality'], "sequence": seq}

        # ---- E. every galaxy opens its own personal universe -----------------------------
        sel = []
        for i in range(9):
            await pg.evaluate("location.hash='#/galaxy'")
            await asyncio.sleep(2.5)
            await pg.evaluate("(()=>{const g=window.STELLAR.sharedGalaxy.impl; g.scheduler.update=()=>({finished:null,started:null}); g.updateCamera=()=>{}; g.advance(0.016);})()")
            d = await diag(pg)
            gx, gy = d['galaxies'][i]['x'], d['galaxies'][i]['y']
            await pg.mouse.click(gx, gy)
            await asyncio.sleep(2.0)
            got = await pg.evaluate("window.STELLAR.activeRecipient && window.STELLAR.activeRecipient.id")
            sel.append({"index": i, "expected": d['galaxies'][i]['id'], "opened": got, "ok": got == d['galaxies'][i]['id']})
        R['E_selection'] = sel

        # ---- F. visible text on the shared screen ------------------------------------------
        await pg.evaluate("location.hash='#/galaxy'")
        await asyncio.sleep(3)
        texts = await pg.evaluate("""(()=>{const out=[]; const w=document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          while(w.nextNode()){ const n=w.currentNode; const t=n.textContent.trim(); if(!t) continue; const el=n.parentElement; if(!el||el.closest('script,style')) continue;
            const cs=getComputedStyle(el); const r=el.getBoundingClientRect();
            let op=1, p=el; while(p){ op*=parseFloat(getComputedStyle(p).opacity); p=p.parentElement; }
            let vis=cs.visibility!=='hidden'&&cs.display!=='none'&&op>0.05&&r.width>2&&r.height>2&&r.right>0&&r.bottom>0&&r.left<innerWidth&&r.top<innerHeight;
            // ignore anything outside an element that is actually on screen
            if(vis){ const hit=document.elementFromPoint(Math.min(innerWidth-1,Math.max(0,r.left+r.width/2)), Math.min(innerHeight-1,Math.max(0,r.top+r.height/2))); vis = !!hit && (el===hit || el.contains(hit) || hit.contains(el)); }
            if(vis) out.push({text:t.slice(0,60), tag:el.tagName, id:el.id||el.className.toString().slice(0,40), opacity:+op.toFixed(2), w:Math.round(r.width), h:Math.round(r.height)}); }
          return out;})()""")
        d = await diag(pg)
        shared_visible = [t for t in texts]
        titles = await pg.evaluate("Array.from(document.querySelectorAll('[title]')).filter(e=>e.offsetParent!==null).map(e=>e.id+':'+e.title)")
        R['F_text'] = {"dom_visible_text_nodes": shared_visible, "visible_title_tooltips": titles,
                       "canvas_labels": [l['text'] for l in d['labels']]}
        # Label geometry: no overlaps between name rectangles
        rects = d['labels']
        overlaps = []
        for i in range(len(rects)):
            for j in range(i + 1, len(rects)):
                a, b = rects[i], rects[j]
                if abs(a['x'] - b['x']) < a['hw'] + b['hw'] and abs(a['y'] - b['y']) < a['hh'] + b['hh']:
                    overlaps.append([a['text'], b['text']])
        R['F_text']['label_overlaps'] = overlaps
        R['console_errors'] = [l for l in (logs + logs2 + logs3) if l.startswith(('error', 'PAGEERROR')) and 'ERR_FAILED' not in l]
        await ctx.close()

        # ---- G. mobile viewport ---------------------------------------------------------------
        ctx, pg, logsm = await open_galaxy(browser, 390, 844, mobile=True)
        dm = await diag(pg)
        await shot(ctx, pg, 'G_mobile_390x844_t0')
        await pg.evaluate("(()=>{const g=window.STELLAR.sharedGalaxy.impl; for(let i=0;i<100;i++) g.advance(0.05);})()")
        await asyncio.sleep(1.5)
        fm2 = await shot(ctx, pg, 'G_mobile_390x844_t+5s')
        dm2 = await diag(pg)
        rects = dm2['labels']
        ov = [[rects[i]['text'], rects[j]['text']] for i in range(9) for j in range(i + 1, 9)
              if abs(rects[i]['x'] - rects[j]['x']) < rects[i]['hw'] + rects[j]['hw'] and abs(rects[i]['y'] - rects[j]['y']) < rects[i]['hh'] + rects[j]['hh']]
        R['G_mobile'] = {"viewport": [390, 844], "renderer": await pg.evaluate("window.STELLAR.sharedGalaxy.renderer"),
                         "label_overlaps": ov, "labels_in_view": all(0 <= l['x'] <= 390 and 0 <= l['y'] <= 844 for l in rects),
                         "frames": dm2['frames'], "quality": dm2['quality']}
        R['console_errors'] += [l for l in logsm if l.startswith(('error', 'PAGEERROR')) and 'ERR_FAILED' not in l]
        await browser.close()
    json.dump(R, open(os.path.join(args.out, 'results.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    print(json.dumps(R, indent=1, ensure_ascii=True)[:9000])


asyncio.run(main())
