import puppeteer from "@cloudflare/puppeteer";

function reduceError(e: any): unknown {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === undefined ? undefined : reduceError(e.cause),
  };
}

export default <ExportedHandler<{BROWSER: Fetcher, PATCH_BROWSER?: boolean}>>{
  async fetch(request, env) {
    try {
    if (env.PATCH_BROWSER) {
      env.PATCH_BROWSER = false;
      const originalBrowser = env.BROWSER;
      env.BROWSER = {
        fetch(input, info) {
          const request = new Request(input, info as any);
          const url = new URL(request.url, "http://placeholder");
          if (url.pathname === "/v1/connectDevtools") {
            console.log(request.headers);
          }
          return originalBrowser.fetch(url, request as any);
        },
        connect: originalBrowser.connect.bind(originalBrowser),
      }
    }

    const { searchParams } = new URL(request.url);
    let url = searchParams.get("url");
    let img;
    if (url) {
      url = new URL(url).toString();
      const browser = await puppeteer.launch(env.BROWSER);
      const page = await browser.newPage();
      await page.goto(url);
      img = await page.screenshot();
      await browser.close();
      return new Response(img, {
        headers: {
          "content-type": "image/jpeg",
        },
      });
    } else {
      return new Response(
        "Please add an ?url=https://example.com/ parameter",
        { status: 404 }
      );
    }
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" },
    });
  }
  },
};
