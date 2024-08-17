/**
 * This module contains a collection of string templates designed to streamline the integration
 * of features like attachments into the LLM request.
 */
export const TEXT_ATTACHMENT_TEMPLATE = `
Your response must be in the language of the relevant queries related to the document.
Below is the content of {attachment_name}:
   
{attachment_parsed_content}
`;

export const URL_ATTACHMENT_TEMPLATE = `
Assume you can access the external URL {attachment_name}.
Your response must be in the language of the relevant queries related to the URL.
Use the URL's content below to respond to the queries:

{content}
`;

export const IMAGE_VISION_ATTACHMENT_TEMPLATE = `
I have uploaded an image ({filename}).
Assume that you can see the attached image.
First, read the image analysis:

<image_analysis>{parsed_image_description}</image_analysis>

Use any relevant parts to inform your response.
Do NOT reference the image analysis in your response.
Respond in the same language as my next message.
`;
