import json, urllib.request, urllib.error

B = "http://127.0.0.1:8000/api/v1"

def req(method, path, token=None, body=None):
    r = urllib.request.Request(B + path, method=method)
    r.add_header("Content-Type", "application/json")
    if token: r.add_header("Authorization", f"Bearer {token}")
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(r, data=data, timeout=10) as resp:
            return resp.status, resp.read().decode(), dict(resp.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(), dict(e.headers)

def login(u, p):
    s, b, _ = req("POST", "/auth/login", body={"username": u, "password": p})
    return s, json.loads(b)

s, adm = login("admin", "Admin@12345"); assert s == 200, b
tok = adm["access_token"]; refresh = adm.get("refresh_token", "")
print(f"1 login ok, refresh_token len={len(refresh)}, expires_in={adm.get('expires_in')}")

s, pop, _ = req("GET", "/population/overview", token=tok); assert s == 200, pop
pop = json.loads(pop); print(f"2 population overview keys={sorted(pop.keys())}, no PHI={'patient' not in str(pop).lower() and 'mrn' not in str(pop).lower()}")

s, csv, h = req("GET", "/population/export?format=csv", token=tok); assert s == 200
phi = sum(1 for w in ["patient_id", "mrn", "@"] if w in csv)
print(f"3 CSV export ct={h.get('Content-Type')}, disp={h.get('Content-Disposition','')[:50]}, PHI_leaks={phi}")

s, pat = login("patient.ross", "Patient@12345"); ptok = pat["access_token"]
s, me, _ = req("GET", "/portal/me", token=ptok); me = json.loads(me)
print(f"4 portal/me = {me.get('first_name')} {me.get('mrn')}")
s, _, _ = req("GET", "/cases", token=ptok); print(f"5 patient -> /cases = {s} (expect 403)")

s, nurse = login("nurse.jones", "Nurse@12345"); ntok = nurse["access_token"]
s, cl, _ = req("GET", "/cases?page_size=1", token=tok); cid = json.loads(cl)["items"][0]["id"]
s, _, _ = req("POST", f"/cases/{cid}/close", token=ntok, body={"closure_reason":"RESOLVED","note":"t"}); print(f"6 nurse close-case = {s} (expect 403)")

s, r2, _ = req("POST", "/auth/refresh", body={"refresh_token": refresh}); r2 = json.loads(r2); print(f"7 refresh rotation, new refresh len={len(r2.get('refresh_token',''))}")
s, _, _ = req("POST", "/auth/refresh", body={"refresh_token": refresh}); print(f"8 reuse old refresh = {s} (expect 401)")

s, ai, _ = req("POST", "/ai/query-dashboard", token=tok, body={"question":"overdue cases"}); ai = json.loads(ai)
print(f"9 ai/query-dashboard keys={sorted(ai.keys())}, disclaimer={'operational' in str(ai).lower() or 'disclaimer' in str(ai).lower()}")

s, npref, _ = req("GET", "/notifications/preferences", token=tok); print(f"10 notification prefs = {npref[:80]}")
s, cases, _ = req("GET", "/cases?overdue_only=true&page_size=5", token=tok); cases = json.loads(cases)
print(f"11 cases overdue filter: total={cases['total']}, pages={cases.get('pages')}, all_overdue={all(c.get('overdue') for c in cases['items'])}")
print("ALL V2 E2E CHECKS DONE")
