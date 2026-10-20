#!/usr/bin/env python3
"""Real-browser check: prefers-reduced-motion keeps a slow ambient loop and no events/comets."""
import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"])
        out = {}
        for label, reduce in (("normal", "no-preference"), ("reduced", "reduce")):
            ctx = await b.new_context(viewport={"width": 640, "height": 400}, reduced_motion=reduce)
            await ctx.route("**/fonts.g*apis.com/**", lambda r: r.abort())
            pg = await ctx.new_page()
            await pg.goto("http://127.0.0.1:4173/", wait_until="commit"); await asyncio.sleep(3)
            await pg.evaluate("location.hash='#/galaxy'"); await asyncio.sleep(4)
            d0 = await pg.evaluate("window.STELLAR.sharedGalaxy.impl.getDiagnostics()")
            await asyncio.sleep(12)
            d1 = await pg.evaluate("window.STELLAR.sharedGalaxy.impl.getDiagnostics()")
            out[label] = {"frames_in_12s": d1['frames'] - d0['frames'], "sim_s_in_12s": round(d1['elapsed'] - d0['elapsed'], 2),
                          "events_started": len(d1['history']), "galaxy_uTime_advanced": d1['galaxies'][0]['uTime'] > d0['galaxies'][0]['uTime'],
                          "sec_per_frame": round(12 / max(1, d1['frames'] - d0['frames']), 3)}
            await ctx.close()
        await b.close()
        print(json.dumps(out, indent=1))
asyncio.run(main())
