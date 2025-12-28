
import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        # Use file:// protocol to open local HTML file
        await page.goto(f'file:///app/index.html')
        await page.screenshot(path='screenshot.png', full_page=True)
        await browser.close()
        print("Screenshot taken and saved as screenshot.png")

if __name__ == '__main__':
    asyncio.run(main())
