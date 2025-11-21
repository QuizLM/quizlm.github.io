from playwright.sync_api import Page, expect, sync_playwright

def verify_homepage(page: Page):
    # Navigate to the local server
    page.goto("http://localhost:3000")

    # Since we are likely logged out, we expect the login page.
    # But we can't easily log in without valid credentials (and Google auth is tricky in headless).
    # However, we can verify that the login page loads correctly,
    # and verify that the tabs work (Sign In / Sign Up).

    expect(page.get_by_text("Welcome to Quiz LM")).to_be_visible(timeout=10000)

    # Verify Sign In / Sign Up tabs exist
    sign_in_tab = page.locator(".auth-tab-btn").filter(has_text="Sign In")
    sign_up_tab = page.locator(".auth-tab-btn").filter(has_text="Sign Up")

    expect(sign_in_tab).to_be_visible()
    expect(sign_up_tab).to_be_visible()

    # Switch to Sign Up
    sign_up_tab.click()
    expect(page.get_by_label("Full Name")).to_be_visible()

    # Take a screenshot of the Login Page
    page.screenshot(path="verification/login_page_final.png")
    print("Login Page Screenshot taken")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_homepage(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error_final.png")
        finally:
            browser.close()
