
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';

export default function SkillsScreen() {
  const [unlocked, setUnlocked] = useState(false);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Skill Challenges</Text>

      <View style={styles.skillCard}>
        <Image source={require('./assets/skill1.png')} style={styles.thumbnail} />
        <Text style={styles.skillTitle}>⚽ Dribble Maze</Text>
        <Text style={styles.description}>Practice your tight-space dribbling with cones.</Text>
        <TouchableOpacity style={styles.button}>
          <Text style={styles.buttonText}>Watch Video</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, { backgroundColor: 'green' }]}>
          <Text style={styles.buttonText}>Mark as Complete</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.skillCard, { opacity: 0.5 }]}>
        <Image source={require('./assets/locked.png')} style={styles.thumbnail} />
        <Text style={styles.skillTitle}>🔒 Long Pass Precision</Text>
        <Text style={styles.description}>Unlock in 2 days!</Text>
        <TouchableOpacity disabled style={styles.button}>
          <Text style={styles.buttonText}>Locked</Text>
        </TouchableOpacity>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f0f4f7',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  skillCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  thumbnail: {
    width: '100%',
    height: 180,
    resizeMode: 'cover',
    borderRadius: 10,
    marginBottom: 10,
  },
  skillTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  button: {
    backgroundColor: '#007bff',
    padding: 10,
    borderRadius: 5,
    marginTop: 5,
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
  },
});
