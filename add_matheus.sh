# Script para adicionar Matheus Ray como ganhador
# Execute este comando após o deploy

curl -X POST https://www.tvzapao.com.br/api/public/add-manual-winner \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Matheus Ray",
    "phone": "11999999999",
    "number": 119,
    "bairro": "Centro",
    "city": "São Paulo"
  }'

# OU direto no PowerShell:
Invoke-RestMethod -Uri "https://www.tvzapao.com.br/api/public/add-manual-winner" -Method Post -ContentType "application/json" -Body '{"name":"Matheus Ray","phone":"11999999999","number":119,"bairro":"Centro","city":"São Paulo"}'
