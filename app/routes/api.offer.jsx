import { json } from "@remix-run/node";

import { authenticate } from "../shopify.server";
import { getOffers } from "../offer.server";
import dbServer from "../db.server";

// The loader responds to preflight requests from Shopify
export const loader = async ({ request }) => {
    await authenticate.public.checkout(request);
};

// The action responds to the POST request from the extension. Make sure to use the cors helper for the request to work.
export const action = async ({ request }) => {
    const { cors, sessionToken } = await authenticate.public.checkout(request);
    const shop = sessionToken.input_data.shop.domain;

    const { accessToken } = await dbServer.session.findFirst({
        where: {
            shop: shop
        }
    });
    // console.log(accessToken)
    // const { admin } = await authenticate.admin(request);

    const offers = await getOffers(accessToken, shop);
    return cors(json({ offers, time: 300 }));
};