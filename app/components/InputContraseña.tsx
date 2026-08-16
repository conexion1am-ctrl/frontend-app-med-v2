import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

// Campo de contraseña con botón para mostrar/ocultar el texto mientras se escribe.
export default function InputContraseña({ value, onChangeText, placeholder, style, editable = true }) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.contenedor}>
      <TextInput
        style={[styles.input, style]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#999"
        secureTextEntry={!visible}
        editable={editable}
      />
      <TouchableOpacity style={styles.botonOjo} onPress={() => setVisible(!visible)}>
        <Text style={styles.botonOjoTexto}>{visible ? '🙈' : '👁️'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { position: 'relative', justifyContent: 'center' },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    paddingRight: 44,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  botonOjo: { position: 'absolute', right: 10, padding: 6 },
  botonOjoTexto: { fontSize: 18 },
});
