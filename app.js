import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import axios from 'axios';

export default function App() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await axios.get('https://backend-app-mediterraneo.onrender.com/api/proyectos/listar');
      setProjects(response.data.proyectos);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#0066cc" /></View>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📋 Proyectos Mediterráneo</Text>
      <FlatList
        data={projects}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.nombre}</Text>
            <Text style={styles.address}>{item.direccion}</Text>
            <Text style={styles.area}>{item.area_m2} m²</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  card: { backgroundColor: 'white', padding: 12, marginBottom: 8, borderRadius: 8 },
  name: { fontSize: 16, fontWeight: 'bold' },
  address: { fontSize: 12, color: '#666', marginTop: 4 },
  area: { fontSize: 11, color: '#999', marginTop: 2 },
});