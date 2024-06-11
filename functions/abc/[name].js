const DROPBOX_DOWNLOAD_API_URL = "https://content.dropboxapi.com/2/files/download";

export async function onRequest(context) {
  const response = await fetch(DROPBOX_DOWNLOAD_API_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "plain/text",
        "Authorization": `Bearer ${context.env.ACCESS_TOKEN}`,
        "Dropbox-API-Arg": `{"path": "/${context.params.name}.abc"}`,
      }
    }
  );

  const data = await response.text();

  return new Response(data);
}
