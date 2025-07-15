import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Prediction } from '../App';

export interface PredictionRecord extends Omit<Prediction, 'id'> {
  createdAt: Date;
}

class DatabaseService {
  private collectionName = 'predictions';

  async savePrediction(prediction: Prediction): Promise<void> {
    try {
      const predictionData: PredictionRecord = {
        timestamp: prediction.timestamp,
        premiseIndex: prediction.premiseIndex,
        rainfall: prediction.rainfall,
        temperature: prediction.temperature,
        waterContent: prediction.waterContent,
        riskLevel: prediction.riskLevel,
        confidence: prediction.confidence || 0,
        createdAt: new Date()
      };

      await addDoc(collection(db, this.collectionName), predictionData);
      console.log('Prediction saved to Firebase');
    } catch (error) {
      console.error('Error saving prediction:', error);
      throw error;
    }
  }

  async getAllPredictions(): Promise<Prediction[]> {
    try {
      const q = query(collection(db, this.collectionName), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate()
      })) as Prediction[];
    } catch (error) {
      console.error('Error fetching predictions:', error);
      throw error;
    }
  }

  async clearAllPredictions(): Promise<void> {
    try {
      const querySnapshot = await getDocs(collection(db, this.collectionName));
      const deletePromises = querySnapshot.docs.map(document => 
        deleteDoc(doc(db, this.collectionName, document.id))
      );
      
      await Promise.all(deletePromises);
      console.log('All predictions cleared from Firebase');
    } catch (error) {
      console.error('Error clearing predictions:', error);
      throw error;
    }
  }
}

export const databaseService = new DatabaseService();