"""Capture OCTOLOOP screenshots via headless Chromium. Run while backend(:8000)+frontend(:3000) are up."""
import time
from playwright.sync_api import sync_playwright

ROOT = "/home/user/.dola/agent_mode/workspace/.sessions/38418540483144977/agents/m_0cLC9aAkYXY/OCTOLOOP/screenshots"
BASE = "http://127.0.0.1:3000"
PATIENT_ID, CASE_ID = 30, 21

ROUTES = [
    ("/patients", "02_patients.png"),
    (f"/patients/{PATIENT_ID}", "03_patient_detail.png"),
    ("/screenings", "04_screenings.png"),
    ("/cases", "05_cases.png"),
    (f"/cases/{CASE_ID}", "06_case_detail_timeline.png"),
    ("/referrals", "07_referrals.png"),
    ("/appointments", "08_appointments.png"),
    ("/notifications", "09_notifications.png"),
    ("/analytics", "10_analytics.png"),
    ("/admin", "11_admin.png"),
]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=["--no-sandbox"])
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()

    # Login page
    page.goto(f"{BASE}/login", wait_until="networkidle")
    time.sleep(1)
    page.screenshot(path=f"{ROOT}/00_login.png", full_page=False)

    # Log in
    page.fill('input[name="username"], input[type="text"], input#username', "admin")
    page.fill('input[type="password"], input#password', "Admin@12345")
    page.click('button[type="submit"]')
    page.wait_for_url("**/", timeout=15000)
    page.wait_for_load_state("networkidle")
    time.sleep(2.5)  # let Recharts animate
    page.screenshot(path=f"{ROOT}/01_dashboard.png", full_page=True)

    for route, fname in ROUTES:
        try:
            page.goto(f"{BASE}{route}", wait_until="networkidle", timeout=20000)
        except Exception as e:
            print(f"warn goto {route}: {e}")
        time.sleep(2.0)
        page.screenshot(path=f"{ROOT}/{fname}", full_page=True)
        print(f"captured {fname}")

    browser.close()
print("DONE")
