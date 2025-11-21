from playwright.sync_api import Page, expect, sync_playwright

def verify_app_load(page: Page):
    # Navigate to the local server
    page.goto("http://localhost:3000")

    # Since the app uses a Loader, we wait for it to disappear or for the login page to appear.
    # We expect the login page because we are not authenticated.

    # Check for text "Welcome to Quiz LM" which is on the Login page
    expect(page.get_by_text("Welcome to Quiz LM")).to_be_visible(timeout=10000)

    # Check for Sign In / Sign Up tabs (using class name to be specific as per error)
    # Or better, specific text or container
    expect(page.locator(".auth-tab-btn").filter(has_text="Sign In")).to_be_visible()
    expect(page.locator(".auth-tab-btn").filter(has_text="Sign Up")).to_be_visible()

    # Take a screenshot of the Login Page
    page.screenshot(path="verification/login_page.png")
    print("Login Page Screenshot taken")

    # Switch to Sign Up tab
    page.locator(".auth-tab-btn").filter(has_text="Sign Up").click()
    expect(page.get_by_label("Full Name")).to_be_visible()
    page.screenshot(path="verification/signup_tab.png")
    print("Signup Tab Screenshot taken")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_app_load(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()
