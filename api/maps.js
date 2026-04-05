export default async function handler(req, res) {
  const API_KEY = process.env.GOOGLE_API_KEY;
  const { query } = req.query;

  if (!query) {
    return res.status(400).json({ error: "Paramètre manquant" });
  }

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${API_KEY}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur" });
  }
}
