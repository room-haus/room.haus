// The native disclosure is shared by the interactive player and its static fallback.
async function openOptions(page) {
  const trigger = page.locator('.player-options > summary, .static-options > summary');
  if (!(await trigger.evaluate(el => el.parentElement.open))) await trigger.click();
}

module.exports = {openOptions};
