const fs = require("fs");
const puppeteer = require("puppeteer");

async function parsePageHtml() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // Colocando cookie de localização de Piracicaba
  await browser.setCookie({
    name: "cep_carrefour_ja",
    value: "13403834",
    domain: ".mercado.carrefour.com.br",
    path: "/",
    httpOnly: false,
    secure: true,
  });

  await page.goto("https://mercado.carrefour.com.br/bebidas", {
    waitUntil: "networkidle0",
  });

  return await page.evaluate(() => {
    const listItems = Array.from(
      document
        .querySelector('[data-fs-product-listing-results="true"]')
        ?.querySelectorAll("li") || []
    );

    const countElement = document.querySelector(
      "div[data-fs-product-listing-results-count]"
    );
    const count = countElement ? countElement.getAttribute("data-count") : null;
    const products = listItems.map((li) => {
      const imageElement = li.querySelector("img");
      const productContent = li.querySelector(
        '[data-product-card-content="true"]'
      );
      const a = productContent.querySelector("a");
      const prices = Array.from(
        productContent.querySelectorAll('[data-test-id="price"]')
      );

      return {
        name: a.innerText || null,
        url: a.href || null,
        prices: prices.map((p) => p.innerText),
        imageUrl: imageElement.src,
      };
    });

    return { count, products };
  });
}

function transformGraphQLResult(result) {
  const products = result.data.search.products.edges.map((edge) => {
    const node = edge.node;
    return {
      name: node.name,
      images: node.image.map((img) => img.url),
      lowPrice: node.offers.lowPrice.toFixed(2),
      url: `https://www.carrefour.com.br/produto/${node.slug}/${node.id}`,
    };
  });

  return {
    count: result.data.search.products.pageInfo.totalCount,
    products,
  };
}

async function fetchFromApi() {
  const url =
    "https://mercado.carrefour.com.br/api/graphql?operationName=ProductsQuery&variables=%7B%22isPharmacy%22%3Afalse%2C%22first%22%3A20%2C%22after%22%3A%2220%22%2C%22sort%22%3A%22score_desc%22%2C%22term%22%3A%22%22%2C%22selectedFacets%22%3A%5B%7B%22key%22%3A%22category-1%22%2C%22value%22%3A%22bebidas%22%7D%2C%7B%22key%22%3A%22category-1%22%2C%22value%22%3A%224599%22%7D%2C%7B%22key%22%3A%22channel%22%2C%22value%22%3A%22%7B%5C%22salesChannel%5C%22%3A2%2C%5C%22regionId%5C%22%3A%5C%22v2.16805FBD22EC494F5D2BD799FE9F1FB7%5C%22%7D%22%7D%2C%7B%22key%22%3A%22locale%22%2C%22value%22%3A%22pt-BR%22%7D%2C%7B%22key%22%3A%22region-id%22%2C%22value%22%3A%22v2.16805FBD22EC494F5D2BD799FE9F1FB7%22%7D%5D%7D";

  const response = await fetch(url);
  const data = await response.json();
  return transformGraphQLResult(data);
}

async function main() {
  // extraindo a partir do HTML
  // const result = await parsePageHtml();

  // extraindo a partir da API GraphQL encontrada nas requisições do mercado.carrefour.com.br/bebidas
  const result = await fetchFromApi();

  fs.writeFileSync("result.json", JSON.stringify(result, null, 2), {
    flag: "w",
  });
  process.exit(0);
}

main();
