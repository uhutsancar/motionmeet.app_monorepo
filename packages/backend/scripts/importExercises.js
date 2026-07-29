import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import Exercise from "../models/Exercise.js";
import connectDB from "../configs/db.js";

// .env dosyasını yükle
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const DATASET_PATH = path.resolve(process.cwd(), "../../exercises-dataset-main/data/exercises.json");

const importExercises = async () => {
  try {
    console.log("MongoDB'ye bağlanılıyor...");
    await connectDB();
    console.log("MongoDB bağlantısı başarılı.");

    console.log(`Veriseti okunuyor: ${DATASET_PATH}`);
    const rawData = fs.readFileSync(DATASET_PATH, "utf-8");
    const exercises = JSON.parse(rawData);
    console.log(`Toplam ${exercises.length} egzersiz bulundu.`);

    let successCount = 0;
    let errorCount = 0;
    
    // AWS S3'e yükleme işlemleri için (örnek olarak sadece DB yazıyoruz, S3 opsiyonel)
    // S3 bağlantısı gerektiren adımlar buraya entegre edilecek.
    const CDN_BASE_URL = process.env.CDN_URL ? process.env.CDN_URL + "/exercises" : "https://motionmeet-assets.s3.eu-north-1.amazonaws.com/exercises";

    const operations = exercises.map((exercise) => {
      const imageUrl = `${CDN_BASE_URL}/${exercise.image}`;
      const gifUrl = `${CDN_BASE_URL}/${exercise.gif_url}`;
      return {
        updateOne: {
          filter: { externalId: exercise.id },
          update: {
            $setOnInsert: {
              name: exercise.name,
              nameNormalized: String(exercise.name || "")
                .trim()
                .toLocaleLowerCase("en-US"),
              muscleGroup: exercise.body_part || "other",
              equipment: exercise.equipment || "body weight",
              instructions: exercise.instructions || {},
              instructionSteps: exercise.instruction_steps || {},
              category: exercise.category,
              target: exercise.target,
              secondary_muscles: exercise.secondary_muscles || [],
              externalId: exercise.id,
              isCustom: false,
            },
            $set: { imageUrl, gifUrl },
          },
          upsert: true,
        },
      };
    });

    for (let offset = 0; offset < operations.length; offset += 500) {
      try {
        const batch = operations.slice(offset, offset + 500);
        await Exercise.bulkWrite(batch, { ordered: false });
        successCount += batch.length;
        console.log(
          `[İlerleme] ${successCount}/${exercises.length} eklendi/güncellendi...`
        );
      } catch (err) {
        console.error(`Egzersiz grubu eklenemedi: ${err.message}`);
        errorCount += Math.min(500, operations.length - offset);
      }
    }

    console.log(`\nImport tamamlandı.`);
    console.log(`Başarılı: ${successCount}`);
    console.log(`Hatalı: ${errorCount}`);

    process.exit(0);
  } catch (error) {
    console.error("Kritik Hata:", error.message);
    process.exit(1);
  }
};

importExercises();
