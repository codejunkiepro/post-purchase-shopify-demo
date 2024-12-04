import { request } from "graphql-request";

export async function getOffers(accessToken, shop) {
  const url = `https://${shop}/admin/api/2024-10/graphql.json`;

  const requestHeaders = {
    'X-Shopify-Access-Token': accessToken,
  };

  const query = `
    query {
      products(first: 2) {
        edges {
          node {
            id
            legacyResourceId
            title
            featuredImage {
              url
            }
            description
            variants(first: 5) {
              edges {
                node {
                  price
                  compareAtPrice
                  id
                  legacyResourceId
                  selectedOptions {
                    name
                    value
                  }
                  sellingPlanGroups(first: 1) {
                    edges {
                      node {
                        sellingPlans(first: 1) {
                          edges {
                            node {
                              id
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  try {
    const { products } = await request({
      url,
      document: query,
      requestHeaders,
    });

    return products.edges.map(({ node }) => {
      const { variants } = node;

      // Extract the variants and prices
      const formattedVariants = variants.edges.map(({ node }) => {
        const { price, legacyResourceId, selectedOptions, sellingPlanGroups } = node;
        const sellingPlanId = sellingPlanGroups.edges?.[0]?.node?.sellingPlans?.edges?.[0]?.node?.id.replace("gid://shopify/SellingPlan/", "");

        return {
          variantID: legacyResourceId,
          selectedOptions,
          sellingPlanId,
          price,
        };
      });

      return {
        id: node.legacyResourceId,
        title: node.title,
        productTitle: node.title,
        productImageURL: node.featuredImage?.url || null,
        productDescription: node.description,
        originalPrice: formattedVariants[0]?.price || 0,  // Set original price from the first variant
        variants: formattedVariants,
      };
    });
  } catch (error) {
    console.error('Error fetching offers:', error);
    throw new Error('Failed to fetch offers from Shopify');
  }
}

export function getSelectedOffer(offerId) {
    return OFFERS.find((offer) => offer.id === offerId);
}
