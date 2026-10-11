# Gmail auto-reply (one filter)

One subject → one template → one filter. The site `/request` form opens mailto with that exact subject.

| Field | Value |
| --- | --- |
| **To (mailto / filter)** | `ari@asu.edu` (also accepts `ari.asulin@gmail.com`) |
| **Subject (exact)** | `Request: Flashback FanEdit Downloads` |
| **Has the words** | `Flashback FanEdit Downloads` |
| **Template name** | `Request: Flashback FanEdit Downloads` |
| **Template body** | Paste from [`generic-template.html`](./generic-template.html) — long letter: Drive links + motivation + ban story + site links |
| **Filter actions** | ☑ Mark as read · ☑ Apply label `Fan Edit Requests` · ☑ **Send template** → `Request: Flashback FanEdit Downloads` |

---

## Manual setup (do this in Gmail)

### A. Enable Templates

1. Gmail → **Settings** (gear) → **See all settings**
2. **Advanced** → **Templates** → **Enable** → **Save Changes**
3. Reload Gmail if prompted

### B. Create the template

1. Click **Compose**
2. Switch the compose window to **rich text** if needed
3. Paste the template body from `gmail/generic-template.html` (open the file, copy all, paste into compose)
4. Toolbar → **More options** (⋮) → **Templates** → **Save draft as template** → **Save as new template**
5. Name it exactly: `Flashback FanEdit Downloads`
6. Save, then discard the draft

### C. Create the filter

1. **Settings** → **Filters and Blocked Addresses** → **Create a new filter**
2. Fill **only**:

| Criteria field | Value |
| --- | --- |
| **Subject** | `Request: Flashback FanEdit Downloads` |

3. Click **Create filter** (not Search)
4. On the actions screen:

| Action | Value |
| --- | --- |
| ☑ **Send template** | `Flashback FanEdit Downloads` |
| ☑ **Mark as read** | *(optional)* |

5. Click **Create filter**

### D. Smoke test

From another account (or BCC yourself), send mail to `ari@asu.edu` with subject exactly:

```text
Request: Flashback FanEdit Downloads
```

You should get the Drive library auto-reply. The website button builds the same mailto:

```text
mailto:ari@asu.edu?subject=Request:%20Flashback%20FanEdit%20Downloads
```

---

## Template body (plain paste)

Open [`generic-template.html`](./generic-template.html) and paste into Gmail compose. Master Drive folder:

https://drive.google.com/drive/folders/1_L1ofj4rDew7V1fA_u91Dp1CX-JiYzv9?usp=drive_link

---

## Cleanup (optional)

Delete any old per-title `Request: …` filters/templates left from earlier imports. They are unused with this design.
