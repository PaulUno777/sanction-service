import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  app.setGlobalPrefix('api');

  //Open API Documentation
  const config = new DocumentBuilder()
    .setTitle('KAMIX Sanction Service')
    .setDescription('KAMIX Sanction Rest API Docs')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  //Cross-origin Configurations
  app.enableCors();

  //start server
  const PORT = configService.get('PORT') || 3000;
  await app.listen(PORT);
  console.log(PORT);
}
bootstrap();
