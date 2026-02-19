type PriceSummaryProps = {
  totalPrice: number
  nights: number
  pricePerNight: number
}

export function PriceSummary({ totalPrice, nights, pricePerNight }: PriceSummaryProps) {
  if (totalPrice <= 0) {
    return null
  }

  return (
    <div className="space-y-2 pt-4">
      <div className="flex justify-between text-lg">
        <span>Total Price:</span>
        <span className="font-bold">₦{totalPrice.toLocaleString()}</span>
      </div>
      <p className="text-sm text-gray-500">
        {nights > 0 && `${nights} night${nights !== 1 ? "s" : ""} at ₦${pricePerNight.toLocaleString()} per night`}
      </p>
    </div>
  )
}
