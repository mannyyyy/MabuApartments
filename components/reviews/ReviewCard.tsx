import { Star } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { Review } from "@/hooks/useInfiniteReviews"

type ReviewCardProps = {
  review: Review
}

export function ReviewCard({ review }: ReviewCardProps) {
  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow rounded-lg overflow-hidden ml-4 bg-[#F5F2ED]">
      <CardHeader className="bg-[#F5F2ED]">
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl bg-[#F5F2ED]">{review.name}</CardTitle>
          <div className="flex items-center">
            {Array.from({ length: 5 }).map((_, index) => (
              <Star
                key={index}
                className={`w-5 h-5 ${index < review.rating ? "text-yellow-400 fill-current" : "text-gray-300"}`}
              />
            ))}
          </div>
        </div>
        <CardDescription className="text-sm mt-1 bg-[#F5F2ED]">
          {new Date(review.createdAt).toLocaleDateString()}
        </CardDescription>
      </CardHeader>
      <CardContent className="py-6">
        <p className="text-gray-700 text-lg leading-relaxed">{review.comment}</p>
      </CardContent>
    </Card>
  )
}
