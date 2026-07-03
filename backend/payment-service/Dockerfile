FROM maven:3.9-amazoncorretto-21 AS build
WORKDIR /app

COPY pom.xml .
RUN mvn dependency:go-offline -q

COPY src ./src
RUN mvn clean package -DskipTests -q

FROM amazoncorretto:21-alpine
WORKDIR /app

COPY --from=build /app/target/*.jar app.jar

EXPOSE 8086
ENTRYPOINT ["java", "-jar", "app.jar"]
