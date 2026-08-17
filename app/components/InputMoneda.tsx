import React from 'react';
import { TextInput } from 'react-native';
import { formatearConPuntosDeMiles, quitarPuntosDeMiles } from '../utils/formatoMoneda';

// Campo de texto para valores en pesos: muestra puntos de miles mientras se escribe
// (2.200.000) y sin decimales. El valor que recibe onChangeValor es siempre el número puro
// en texto (sin puntos), listo para guardar en el estado y enviar al backend.
export default function InputMoneda({ value, onChangeValor, style, placeholder = 'Ej: 2200000', ...resto }) {
  return (
    <TextInput
      style={style}
      value={formatearConPuntosDeMiles(value)}
      onChangeText={(texto) => onChangeValor(quitarPuntosDeMiles(texto))}
      placeholder={placeholder}
      placeholderTextColor="#999"
      keyboardType="numeric"
      {...resto}
    />
  );
}
