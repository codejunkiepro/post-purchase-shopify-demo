/**
 * Extend Shopify Checkout with a custom Post Purchase user experience.
 * This template provides two extension points:
 *
 *  1. ShouldRender - Called first, during the checkout process, when the
 *     payment page loads.
 *  2. Render - If requested by `ShouldRender`, will be rendered after checkout
 *     completes
 */
import React, { useEffect, useMemo, useState } from "react";

import {
  extend,
  render,
  BlockStack,
  Button,
  CalloutBanner,
  Heading,
  Image,
  Layout,
  TextBlock,
  TextContainer,
  View,
  Text,
  Banner,
  useExtensionInput,
  FormLayout,
  Select,
  Radio,
  Separator,
  Tiles,
  Form
} from "@shopify/post-purchase-ui-extensions-react";

// For local development, replace APP_URL with your local tunnel URL.
const APP_URL = "https://stages-differ-developers-interim.trycloudflare.com";

/**
 * Entry point for the `ShouldRender` Extension Point.
 *
 * Returns a value indicating whether or not to render a PostPurchase step, and
 * optionally allows data to be stored on the client for use in the `Render`
 * extension point.
 */
extend(
  "Checkout::PostPurchase::ShouldRender",
  async ({ storage, inputData }) => {
    const postPurchaseOffer = await fetch(`${APP_URL}/api/offer`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${inputData.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        referenceId: inputData.initialPurchase.referenceId,
      }),
    }).then((response) => response.json());
    console.log(postPurchaseOffer);
    await storage.update(postPurchaseOffer);

    // For local development, always show the post-purchase page
    return { render: true };
  }
);

/**
 * Entry point for the `Render` Extension Point
 *
 * Returns markup composed of remote UI components.  The Render extension can
 * optionally make use of data stored during `ShouldRender` extension point to
 * expedite time-to-first-meaningful-paint.
 */
render("Checkout::PostPurchase::Render", () => <App />);

// Top-level React component
export function App() {
  const { storage, inputData, calculateChangeset, applyChangeset, done } =
    useExtensionInput();

  const { offers, time } = storage.initialData;
  const [remainingTime, setRemainingTime] = useState(time); // Assuming `time` is in seconds
  useEffect(() => {
    if (remainingTime > 0) {
      const timer = setInterval(() => {
        setRemainingTime((prevTime) => Math.max(prevTime - 1, 0)); // Decrement every second
      }, 1000);

      return () => clearInterval(timer); // Clean up on unmount
    }
  }, [remainingTime]);

  const formatTime = (timeInSeconds) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = timeInSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`; // Format time as mm:ss
  };
  
  return (
    <BlockStack spacing="loose">
      <CalloutBanner title="Black Friday only!">
        <Text size="medium" emphasized>
          Don't miss out! The perfect complement to the Dark Roast Duo
        </Text>
      </CalloutBanner>
      <Banner iconHidden status="warning">
        <TextContainer alignment="center">
          <Text>Don't miss out -- your special offer ends in: </Text>
          <Text emphasized> {formatTime(remainingTime)} </Text>
        </TextContainer>
      </Banner>
      {offers.map(offer => (<OfferItem key={offer.id} purchaseOption={offer} />))}
    </BlockStack>
  );
}

function OfferItem({ purchaseOption }) {
  const { inputData, calculateChangeset, applyChangeset, done } =
    useExtensionInput();
  const [calculatedPurchase, setCalculatedPurchase] = useState();
  const [loading, setLoading] = useState(true);
  const [purchaseType, setPurchaseType] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [size, setSize] = useState(0);
  
  const changes = useMemo(() => {
    const { variants } = purchaseOption;
    const variant = variants[size];
    if (purchaseType === 0) {
      return [
        {
          type: "add_variant",
          variantId: variant.variantID,
          quantity: quantity,
          discount: {
            value: 50,
            valueType: "percentage",
            title: "Save 50%",
          },
        },
      ];
    } else {
      return [
        {
          type: "add_subscription",
          variantId: variant.variantID,
          quantity: quantity,
          sellingPlanId: variant.sellingPlanId,
          initialShippingPrice: 10,
          recurringShippingPrice: 10,
          discount: {
            value: 20,
            valueType: "percentage",
            title: "Save 50%",
          },
          shippingOption: {
            title: "Subscription shipping line",
            presentmentTitle: "Subscription shipping line",
          },
        },
      ];
    }
  }, [purchaseOption, purchaseType, quantity, size]);

  useEffect(() => {
    async function calculatePurchase() {
      // Call Shopify to calculate the new price of the purchase, if the above changes are applied.
      const result = await calculateChangeset({
        changes: changes,
      });

      setCalculatedPurchase(result.calculatedPurchase);
      setLoading(false);
    }

    calculatePurchase();
  }, [calculateChangeset, changes]);

  const sizeOptions = useMemo(() => {
    return purchaseOption.variants.map((variant, index) => {
      const sizeOption = variant.selectedOptions.filter(
        (item) => item.name === "Size"
      );
      return {
        value: index,
        label: sizeOption[0].value,
      };
    });
  }, [purchaseOption]);

  // Extract values from the calculated purchase.
  const shipping =
    calculatedPurchase?.addedShippingLines[0]?.priceSet?.presentmentMoney
      ?.amount;
  const taxes =
    calculatedPurchase?.addedTaxLines[0]?.priceSet?.presentmentMoney?.amount;
  const total = calculatedPurchase?.totalOutstandingSet.presentmentMoney.amount;
  const discountedPrice =
    calculatedPurchase?.updatedLineItems[0].totalPriceSet.presentmentMoney
      .amount;
  const originalPrice =
    calculatedPurchase?.updatedLineItems[0].priceSet.presentmentMoney.amount;
    
  async function acceptOffer() {
    setLoading(true);

    // Make a request to your app server to sign the changeset with your app's API secret key.
    const token = await fetch(`${APP_URL}/api/sign-changeset`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${inputData.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        referenceId: inputData.initialPurchase.referenceId,
        changes: changes,
      }),
    })
      .then((response) => response.json())
      .then((response) => response.token)
      .catch((e) => console.log(e));

    // Make a request to Shopify servers to apply the changeset.
    await applyChangeset(token);

    // Redirect to the thank-you page.
    done();
  }

  function declineOffer() {
    setLoading(true);
    // Redirect to the thank-you page
    done();
  }

  return (
    <Layout
      maxInlineSize={0.95}
      media={[
        { viewportSize: "small", sizes: [1, 30, 1] },
        { viewportSize: "medium", sizes: [300, 30, 0.5] },
        { viewportSize: "large", sizes: [400, 30, 0.33] },
      ]}
    >
      <View>
        <Image source={purchaseOption.productImageURL} />
      </View>
      <View />
      <BlockStack spacing="tight">
        <Heading>{purchaseOption.productTitle} </Heading>
        <PriceHeader
          discountedPrice={discountedPrice}
          originalPrice={originalPrice}
          loading={!calculatedPurchase}
          purchaseType={purchaseType}
          quantity={quantity}
        />
        <ProductDescription text={"Surprise yourself! 😃"} />
        <Form>
        <FormLayout>
          <Radio
            // id={"radio"}
            name="radio"
            value={purchaseType === 0}
            onChange={() => setPurchaseType(0)}
          >
            One - time Purchange
          </Radio>
          <Radio
            // id={"radio1"}
            name="radio"
            value={purchaseType === 1}
            onChange={() => setPurchaseType(1)}
          >
            Subscribe and Save
          </Radio>
        </FormLayout>
        <FormLayout>
          <Select
            label="Size"
            value={size}
            options={sizeOptions}
            onChange={(value) => setSize(value)}
          />
        </FormLayout>
        <FormLayout>
          <Select
            label="Quantity"
            value={quantity}
            options={Array.from({ length: 5 }, (_, index) => index + 1).map(
              (item) => {
                return {
                  value: item,
                  label: item,
                };
              }
            )}
            onChange={(value) => setQuantity(value)}
          />
        </FormLayout>
        <BlockStack spacing="tight">
          <Separator />
          <MoneyLine
            label="Subtotal"
            amount={discountedPrice}
            loading={!calculatedPurchase}
          />
          <MoneyLine
            label="Shipping"
            amount={shipping}
            loading={!calculatedPurchase}
          />
          <MoneyLine
            label="Taxes"
            amount={taxes}
            loading={!calculatedPurchase}
          />
          <Separator />
          <MoneySummary label="Total" amount={total} />
        </BlockStack>
        <BlockStack>
          <Button onPress={acceptOffer} submit loading={loading}>
            Pay now · {formatCurrency(total)}
          </Button>
          <Button onPress={declineOffer} subdued loading={loading}>
            Decline this offer
          </Button>
        </BlockStack>
        </Form>
      </BlockStack>
    </Layout>
  );
}

function PriceHeader({
  discountedPrice,
  originalPrice,
  loading,
  purchaseType,
  quantity,
}) {
  return (
    <TextContainer alignment="leading" spacing="xloose">
      <Text emphasized size="large" appearance="critical">
        {" "}
        {!loading && formatCurrency(discountedPrice)}
      </Text>
      <Text role="deletion" size="small">
        {!loading && (Number(originalPrice) * Number(quantity)).toFixed(2)}
      </Text>
      {!loading && (
        <Text appearance="success" size="large">
          {purchaseType === 0 ? " (Save 50%)" : " (Save 20%)"}
        </Text>
      )}
    </TextContainer>
  );
}

function ProductDescription({ text }) {
  return (
    <BlockStack spacing="xtight">
      <TextBlock subdued> {text} </TextBlock>
    </BlockStack>
  );
}

function MoneyLine({ label, amount, loading = false }) {
  return (
    <Tiles>
      <TextBlock size="small">{label}</TextBlock>
      <TextContainer alignment="trailing">
        <TextBlock emphasized size="small">
          {loading ? "-" : formatCurrency(amount)}
        </TextBlock>
      </TextContainer>
    </Tiles>
  );
}

function MoneySummary({ label, amount }) {
  return (
    <Tiles>
      <TextBlock size="medium" emphasized>
        {label}
      </TextBlock>
      <TextContainer alignment="trailing">
        <TextBlock emphasized size="medium">
          {formatCurrency(amount)}
        </TextBlock>
      </TextContainer>
    </Tiles>
  );
}

function formatCurrency(amount) {
  if (!amount || parseInt(amount, 10) === 0) {
    return "Free";
  }
  return `£${amount}`;
}
