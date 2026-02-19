import { NextResponse } from "next/server"
import { v2 as cloudinary } from "cloudinary"
import { officialIdUploadSchema } from "@/lib/validators/booking-request.schema"

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

function getCloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary credentials are not configured")
  }

  return { cloudName, apiKey, apiSecret }
}

async function uploadBufferToCloudinary(buffer: Buffer, filename: string, mimeType: string) {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig()

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  })

  const folder = process.env.CLOUDINARY_ID_UPLOAD_FOLDER || "mabu/official-ids"

  return new Promise<{ secure_url: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "auto",
        public_id: `${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`,
        overwrite: false,
        tags: ["official-id", "booking"],
        format: mimeType === "application/pdf" ? "pdf" : undefined,
      },
      (error, result) => {
        if (error || !result) {
          reject(error || new Error("Cloudinary upload failed"))
          return
        }
        resolve({ secure_url: result.secure_url })
      },
    )

    stream.end(buffer)
  })
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json({ message: "Missing file upload" }, { status: 400 })
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ message: "File exceeds 10MB limit" }, { status: 400 })
    }

    const parsed = officialIdUploadSchema.safeParse({
      mimeType: file.type,
      sizeBytes: file.size,
    })

    if (!parsed.success) {
      return NextResponse.json({ message: "Unsupported file type or size" }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const uploaded = await uploadBufferToCloudinary(buffer, file.name, file.type)

    return NextResponse.json({
      url: uploaded.secure_url,
      mimeType: file.type,
      originalName: file.name,
      sizeBytes: file.size,
    })
  } catch (error) {
    console.error("Official ID upload failed", error)
    return NextResponse.json({ message: "Failed to upload official ID" }, { status: 500 })
  }
}
