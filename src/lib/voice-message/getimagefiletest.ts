// app/actions.ts
'use server'
export async function getImageFile() {
    console.log('getImageFile')
  // Your logic to fetch or generate the image data...
  const imageData = Buffer.from('sdf') // Replace with your implementation

  // Create response with headers
  return new Response(imageData, {
    headers: {
      'content-type': 'image/png'
    }
  });
}