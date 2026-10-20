import { createContext, useContext } from 'react'

/** Gir oppgaveradene tilgang til å åpne detaljpanelet uten å sende funksjonen gjennom alle lag. */
export const OpenTaskContext = createContext<(id: string) => void>(() => {})
export const useOpenTask = () => useContext(OpenTaskContext)
