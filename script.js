fetch("/api/firebase")
  .then(res => res.json())
  .then(data => console.log("Données récupérées :", data))
  .catch(err => console.error("Erreur fetch API :", err));