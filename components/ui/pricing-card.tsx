import Image, { StaticImageData } from "next/image";
import React, { MouseEventHandler } from "react";
import { LampComponent, LampContainer } from "@/components/global/lamp";
import { CheckCircle2 } from "lucide-react";


export interface PricingPlan {
  title: string;
  description: string;
  price: number;
  pricePeriod?: string;
  features: string[];
  image: StaticImageData;
  onAction?: () => void;
}

export function PricingCard({
  title,
  description,
  price,
  pricePeriod,
  features,
  image,
  onAction
}: PricingPlan) {
  return (
    <div className="relative w-full rounded-2xl bg-white p-2 shadow-lg">
      <div className="flex h-full flex-col justify-between rounded-xl bg-white p-6">
        <div>
          <div className="relative flex items-center justify-center">
            <div className="mb-2 flex items-center justify-center">
              <Image
                src={image}
                alt={title}
                width={40}
                height={40}
                className="h-20 w-20"
              />
            </div>
          </div>
          <h3 className="mb-2 text-center text-2xl font-bold">{title}</h3>
          <p className="text-center text-base font-normal text-neutral-600">
            {description}
          </p>
          <div className="my-4 flex items-baseline justify-center gap-1">
            <span className="text-5xl font-bold">${price}</span>
            <span className="text-neutral-600">/{pricePeriod}</span>
          </div>
          <ul className="mb-8 space-y-4">
            {features.map((feature, index) => (
              <li key={index} className="flex items-center gap-2">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
                <span className="text-neutral-600">{feature}</span>
              </li>
            ))}
          </ul>
        </div>
        <button
          onClick={onAction}
          className="inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-3 text-center font-medium text-white hover:from-blue-600 hover:to-blue-700"
        >
          Get Started
        </button>
      </div>
    </div>
  );
}

export function PricingCardWrapper({
  pricingPlans,
}: {
  pricingPlans: PricingPlan[];
}) {
  return (
    <div className="mx-auto grid max-w-7xl gap-4 px-4 sm:px-6 lg:grid-cols-3 lg:px-8">
      {pricingPlans.map((plan, index) => (
        <PricingCard key={index} {...plan} />
      ))}
    </div>
  );
}
