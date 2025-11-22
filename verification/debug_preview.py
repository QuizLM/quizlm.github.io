from playwright.sync_api import sync_playwright

def debug_blank_page():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Capture console logs
        page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))
        page.on("pageerror", lambda exc: print(f"ERROR: {exc}"))

        print("Navigating to http://localhost:4173/ ...")
        try:
            page.goto("http://localhost:4173/", timeout=10000)
            print("Navigation complete.")

            # Check if root has content
            root_html = page.inner_html("#root")
            print(f"ROOT HTML CONTENT: {root_html[:500]}...")

            page.screenshot(path="verification/debug_blank.png")
        except Exception as e:
            print(f"Playwright Exception: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    debug_blank_page()
