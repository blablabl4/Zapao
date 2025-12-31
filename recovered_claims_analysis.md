# Análise dos Claims "Recuperados"

Este documento cruza os claims "Recuperado" no banco com os dados do extrato MP para identificar:
1. O nome real de cada cliente
2. O horário original do pagamento
3. Em qual jogo o cliente DEVERIA estar (baseado no horário)

---

## Claims "Recuperado" no Jogo 1

| Claim# | Payment ID | Nome no MP | Horário Original | Jogo Correto |
|--------|------------|------------|------------------|--------------|
| 1978 | 140122670338 | (Verificar no MP) | - | - |
| 1981 | 140050582254 | Paulo Cesar De Souza | 14h11 | Jogo 1 ✅ |
| 1982 | 139406100999 | Jéssica Batista Moreira | 14h53 | Jogo 1 ✅ |
| 1983 | 140054806722 | Renata Rodrigues | 14h53 | Jogo 1 ✅ |
| 1984 | 140058810890 | Bruno De Oliveira Santana | 15h29 | Jogo 1 ✅ |
| 1985 | 139410830895 | Cláudia Perez | 15h29 | Jogo 1 ✅ |
| 1991 | 140059665200 | Marinalva Gomes De Macedo Dias Camargo | 15h41 | Jogo 1 ✅ |
| 1992 | 140058741608 | Gessica Saraiva | 15h41 | Jogo 1 ✅ |
| 1993 | 139412550753 | Daniele Souza Marcantonio | 15h41 | Jogo 1 ✅ |
| 1994 | 139409786043 | Fernando Gonçalves De Oliveira | 15h42 | Jogo 1 ✅ |
| 1995 | 140059979004 | Thamiris Bueno Da Silva | 15h42 | Jogo 1 ✅ |
| 1996 | 140059027458 | Adailton Da Silva Campos | 15h42 | Jogo 1 ✅ |
| 1997 | 140061406454 | Diana Da Silva Oliveira | 15h43 | Jogo 1 ✅ |
| 1998 | 140058795742 | Cláudia Alves Pereira | 15h44 | Jogo 1 ✅ |
| 1999 | 140058503784 | Eduardo Da Silva Lemos | 15h44 | Jogo 1 ✅ |
| 2000 | 139410461807 | Luiz Claudio Affonso | 15h44 | Jogo 1 ✅ |
| 2001 | 140059973138 | Izaias Oliveira Silva | 15h45 | Jogo 1 ✅ |
| 2002 | 140060668936 | Valter Vieira Leite | 15h45 | Jogo 1 ✅ |
| 2003 | 139410506073 | Erivania Oliveira Da Silva | 15h46 | Jogo 1 ✅ |
| 2004 | 140060025282 | Samara Gabriela Da Silva Siqueira | 15h47 | Jogo 1 ✅ |
| 2005 | 140060669024 | Ancelmo Muniz | 15h47 | Jogo 1 ✅ |
| 2006 | 139411893367 | Thiago Gomes Da Silva | 15h47 | Jogo 1 ✅ |
| 2007 | 139412027269 | Solange Aparecida Lopes Aguilera | 15h48 | Jogo 1 ✅ |
| 2008 | 140058742034 | Maricene Alves Lima | 15h49 | Jogo 1 ✅ |
| 2009 | 140061080922 | Aldilene Quirino De Sousa | 15h50 | Jogo 1 ✅ |
| 2010 | 140065156418 | Gilvan Rodrigues Da Costa | 16h13 | Jogo 1 ✅ |
| 2011 | 140064532792 | Lucas Santos De Souza | 16h15 | Jogo 1 ✅ |
| 2012 | 139417150621 | Antonio Israel | 16h16 | Jogo 1 ✅ |
| 2013 | 139418284147 | Gilvan Rodrigues Da Costa | 16h17 | Jogo 1 ✅ |
| 2014 | 139416480971 | Robson Manoel Da Silva (R$40 = 2 cotas) | 16h18 | Jogo 1 ✅ |
| 2015 | 140062477910 | Simone Farias Da Silva | 16h19 | Jogo 1 ✅ |
| 2016 | 139415155735 | Cleidiana | 16h19 | Jogo 1 ✅ |
| 2017 | 140064533080 | Sueli Souto Da Silva | 16h20 | Jogo 1 ✅ |
| 2018 | 139416265279 | Keteny Santos Da Silva | 16h21 | Jogo 1 ✅ |
| 2019 | 139417150997 | Gilvan Rodrigues Da Costa | 16h23 | Jogo 1 ✅ |

---

## Claims "Recuperar MP" no Jogo 5

| Claim# | Payment ID | Nome no MP | Horário Original | Jogo Correto |
|--------|------------|------------|------------------|--------------|
| 1808 | 139437424777 | Laureci Alves De Santana | 18h43 | Jogo 4? |
| 1809 | 139434567021 | Cláudia Perez | 18h29 | Jogo 4? |
| 1810 | 139433693097 | Kelly Cristina Da Silva | 18h26 | Jogo 4? |

---

## Análise de Horários

**Jogo 1 (Abertura):** 14h11 - 16h23 (30/12)
**Jogo 2:** 20h04 - 20h33 (30/12)
**Jogo 3:** 20h47 - 21:20 (30/12)
**Jogo 4:** 21h23 - 22:55 (30/12)
**Jogo 5:** 23h45 (30/12) - 02:35 (31/12)
**Jogo 6:** 02h35+ (31/12)

---

## Conclusão

1. **Os "Recuperado Jogo1"** (claims 1981-2019) são pagamentos do período 14h11-16h23 que falharam no webhook. **TODOS pertencem corretamente ao Jogo 1.**

2. **Os 3 "Cliente (Recuperar MP)"** no Jogo 5 (claims 1808-1810) têm payment_ids do horário 18h26-18h43. Esse horário corresponderia ao **Jogo 4** (que começou às 21h23). 

   **⚠️ Possível erro:** Esses 3 deveriam estar no Jogo 4, não no Jogo 5!

3. **Os 51 órfãos** identificados anteriormente (15h29-15h41) são do período do Jogo 1 mas **ainda não têm claims criados**.
