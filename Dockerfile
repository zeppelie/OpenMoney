# 1) Frontend Angular
FROM node:22-alpine AS web
WORKDIR /web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# 2) Backend .NET
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS api
WORKDIR /src
COPY src/ ./
RUN dotnet publish OpenMoney.Api/OpenMoney.Api.csproj -c Release -o /out

# 3) Immagine finale: l'API serve anche i file statici di Angular
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=api /out ./
COPY --from=web /web/dist/web/browser ./wwwroot
ENV ASPNETCORE_HTTP_PORTS=8080
ENTRYPOINT ["dotnet", "OpenMoney.Api.dll"]
