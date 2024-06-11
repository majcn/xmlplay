async function getDropboxAccessToken(refresh_token, access_key, secret_key) {
  const response = await fetch("https://api.dropbox.com/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      "grant_type": "refresh_token",
      "refresh_token": refresh_token,
      "client_id": access_key,
      "client_secret": secret_key,
    }),
  });

  const data = await response.json();

  return data["access_token"];
}

export async function onRequest(context) {
  const accessToken = await getDropboxAccessToken(
    context.env.DROPBOX_REFRESH_TOKEN,
    context.env.DROPBOX_ACCESS_KEY,
    context.env.DROPBOX_SECRET_KEY,
  );

  const response = await fetch("https://content.dropboxapi.com/2/files/download", {
    method: "POST",
    headers: {
      "Content-Type": "text/plain",
      "Authorization": `Bearer ${accessToken}`,
      "Dropbox-API-Arg": `{"path": "/${context.params.name}.abc"}`,
    },
  });

  const data = await response.text();

  return new Response(data, {
    headers: {
      "Cache-Control": "public, max-age=86400",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
