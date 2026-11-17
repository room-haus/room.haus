const {test, expect} = require('@playwright/test');

for (const reducedMotion of ['no-preference', 'reduce']) {
  test(`splash and archive round trip with motion preference ${reducedMotion}`, async ({page}) => {
    await page.emulateMedia({reducedMotion});
    await page.addInitScript(() => {
      window.addEventListener('pagereveal', async ({viewTransition}) => {
        if (!viewTransition) {
          sessionStorage.setItem('observedSlide', 'instant');
          return;
        }
        await viewTransition.ready;
        const incoming = document.getAnimations().find(animation => animation.animationName === 'room-slide-in');
        const start = incoming?.effect.getKeyframes()[0].transform;
        await viewTransition.finished;
        sessionStorage.setItem('observedSlide', start || 'missing');
      });
    });
    await page.goto('/');
    const archive = page.getByRole('link', {name: 'S/S 2017-2019'});
    const home = page.getByRole('link', {name: 'ROOM home'});

    async function travel(action, destination, start) {
      await page.evaluate(() => sessionStorage.removeItem('observedSlide'));
      await action();
      await expect(page).toHaveURL(new RegExp(destination + '$'));
      await expect.poll(() => page.evaluate(() => sessionStorage.getItem('observedSlide')))
        .toBe(reducedMotion === 'reduce' ? 'instant' : `translateX(${start}%)`);
    }

    await travel(() => archive.click(), '/mixes/', 100);
    await travel(() => page.goBack(), '/', -100);
    await travel(() => page.goForward(), '/mixes/', 100);
    await travel(() => home.click(), '/', -100);
    await expect(archive).toBeVisible();
  });
}
