import platform from "./config/platform.js";

export default function configureEleventy(eleventyConfig) {
  eleventyConfig.addGlobalData("platform", platform);
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({ "src/static/_headers": "_headers" });
  eleventyConfig.addPassthroughCopy({ "src/static/_redirects": "_redirects" });
  eleventyConfig.addPassthroughCopy({ "src/static/_routes.json": "_routes.json" });
  eleventyConfig.addPassthroughCopy({ "src/static/.well-known": ".well-known" });

  eleventyConfig.addFilter("absoluteUrl", (path = "/") => {
    const normalized = path.startsWith("/") ? path : `/${path}`;
    return `${platform.baseUrl}${normalized}`;
  });

  eleventyConfig.addFilter("json", (value) => JSON.stringify(value));

  return {
    dir: {
      input: "src",
      includes: "_includes",
      output: "dist"
    },
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
    templateFormats: ["njk", "md", "html"]
  };
}
