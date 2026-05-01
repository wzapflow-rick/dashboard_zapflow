                {/* Header - Estilo iFood */}
                <header className="relative">
                    {/* Banner */}
                    <div className="relative h-44 sm:h-56 bg-[#1a1a1a]">
                        {empresaBanner ? (
                            <>
                                <Image 
                                    src={empresaBanner} 
                                    alt={`Banner de ${empresaNome}`} 
                                    fill 
                                    className="object-cover" 
                                    priority 
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/60 to-transparent" />
                            </>
                        ) : (
                            <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a]">
                                <div className="absolute inset-0 opacity-10">
                                    <div className="absolute top-10 right-10 w-32 h-32 bg-[#22c55e] rounded-full filter blur-3xl"></div>
                                    <div className="absolute bottom-10 left-10 w-40 h-40 bg-[#22c55e] rounded-full filter blur-3xl"></div>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {/* Logo posicionada sobre o banner - FORA do container com overflow */}
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-1/2 z-30">
                        <div
                            className="size-24 sm:size-28 rounded-2xl flex items-center justify-center text-white font-bold text-3xl sm:text-4xl shrink-0 shadow-2xl border-4 border-[#0a0a0a] bg-[#1a1a1a] overflow-hidden transition-transform hover:scale-105"
                            style={!empresaLogo ? { background: 'linear-gradient(135deg, #22c55e, #16a34a)' } : { background: '#1a1a1a' }}
                        >
                            {empresaLogo ? (
                                <Image src={empresaLogo} alt={empresaNome} width={112} height={112} className="size-full object-cover" />
                            ) : (
                                <span className="text-white">{inicial}</span>
                            )}
                        </div>
                    </div>

                    {/* Info da empresa */}
                    <div className="max-w-2xl mx-auto px-4 pt-16 pb-6 text-center">
                        <h1 className="font-black text-2xl sm:text-3xl text-white leading-tight mb-4 uppercase tracking-tight">
                            {empresaNome}
                        </h1>
                        
                        {/* Tags - Estilo iFood */}
                        <div className="flex flex-wrap items-center justify-center gap-2">
                            {empresaNincho && (
                                <span className="text-xs text-gray-300 font-medium bg-[#1a1a1a] px-3 py-1.5 rounded-full border border-[#2a2a2a]">
                                    {empresaNincho}
                                </span>
                            )}
                            {empresaCidade && (
                                <span className="flex items-center gap-1.5 text-xs text-gray-300 font-medium bg-[#1a1a1a] px-3 py-1.5 rounded-full border border-[#2a2a2a]">
                                    <MapPin className="size-3" />
                                    {empresaCidade}
                                </span>
                            )}
                            <span className="flex items-center gap-1.5 text-xs text-[#22c55e] font-semibold bg-[#22c55e]/10 px-3 py-1.5 rounded-full border border-[#22c55e]/20">
                                <Clock className="size-3" />
                                Aberto agora
                            </span>
                        </div>
                    </div>
                </header>
