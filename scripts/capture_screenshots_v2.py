"""V2 after-screenshots: staff dashboard+population, patient portal, Arabic RTL."""
import time, json, urllib.request
from playwright.sync_api import sync_playwright

ROOT = "/home/user/.dola/agent_mode/workspace/.sessions/38418540483144977/agents/m_0cLC9aAkYXY/OCTOLOOP/screenshots/v2_after"
BASE = "http://127.0.0.1:3000"
BAPI = "http://127.0.0.1:8000/api/v1"

def token_for(u, p):
    r = urllib.request.Request(BAPI+"/auth/login", data=json.dumps({"username":u,"password":p}).encode(), headers={"Content-Type":"application/json"})
    return json.loads(urllib.request.urlopen(r, timeout=10).read())

def session_ctx(p, tok, user, locale=None):
    ctx = p.chromium.launch(headless=True, args=["--no-sandbox"]).new_context(viewport={"width":1440,"height":900}, locale=locale or "en-US")
    init = f"localStorage.setItem('octoloop_token','{tok}'); localStorage.setItem('octoloop_user', JSON.stringify({json.dumps(user)}));"
    if locale: init += f"localStorage.setItem('octoloop_locale','{locale}'); document.cookie='NEXT_LOCALE={locale};path=/';"
    ctx.add_init_script(init)
    return ctx

with sync_playwright() as p:
    adm = token_for("admin", "Admin@12345")
    user = {"id":1,"username":"admin","full_name":"System Administrator","role":"admin"}
    ctx = session_ctx(p, adm["access_token"], user)
    pg = ctx.new_page()
    for route, fname in [("/","01_dashboard_v2.png"), ("/population","02_population_v2.png"), ("/cases","03_cases_v2.png"), ("/analytics","04_analytics_v2.png"), ("/admin","05_admin_v2.png")]:
        pg.goto(f"{BASE}{route}", wait_until="networkidle", timeout=30000)
        time.sleep(2.5)
        pg.screenshot(path=f"{ROOT}/{fname}", full_page=True)
        print("captured", fname)
    ctx.close()

    # Patient portal
    pat = token_for("patient.ross", "Patient@12345")
    puser = {"id":pat["user"]["id"],"username":"patient.ross","full_name":"Olivia Ross","role":"patient"}
    ctx = session_ctx(p, pat["access_token"], puser)
    pg = ctx.new_page()
    for route, fname in [("/portal","06_portal_overview.png"), ("/portal/appointments","07_portal_appointments.png")]:
        pg.goto(f"{BASE}{route}", wait_until="networkidle", timeout=30000)
        time.sleep(2.0)
        pg.screenshot(path=f"{ROOT}/{fname}", full_page=True)
        print("captured", fname)
    ctx.close()

    # Arabic RTL dashboard
    ctx = session_ctx(p, adm["access_token"], user, locale="ar")
    pg = ctx.new_page()
    pg.goto(f"{BASE}/", wait_until="networkidle", timeout=30000)
    time.sleep(3)
    pg.screenshot(path=f"{ROOT}/08_dashboard_arabic_rtl.png", full_page=True)
    print("captured 08_dashboard_arabic_rtl.png")
    ctx.close()
print("DONE")
